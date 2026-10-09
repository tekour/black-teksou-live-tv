
import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Hls from "hls.js";
import {
  Search, Upload, Link as LinkIcon, Star, Play, Pause,
  Volume2, VolumeX, Maximize, RefreshCw, Tv, List, X,
  Menu, ChevronRight, Settings, Trash2, Film, Heart,
  Home, Clapperboard, Radio
} from "lucide-react";
import "./styles.css";

function parseM3U(text) {
  const lines = text.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  const channels = [];

  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXTINF")) continue;

    const info = lines[i];
    const url = lines[i + 1] && !lines[i + 1].startsWith("#")
      ? lines[i + 1] : "";

    if (!url) continue;

    const name = info.includes(",")
      ? info.slice(info.indexOf(",") + 1).trim()
      : "Chaîne";

    const attr = key =>
      info.match(new RegExp(`${key}="([^"]*)"`))?.[1] || "";

    channels.push({
      id: `${attr("tvg-id") || name}-${url}`,
      name,
      url,
      group: attr("group-title") || "Autres",
      logo: attr("tvg-logo")
    });
  }

  return channels;
}

function App() {
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const fileRef = useRef(null);

  const [channels, setChannels] = useState([]);
  const [current, setCurrent] = useState(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("Toutes");
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("m3u-favorites") || "[]");
    } catch {
      return [];
    }
  });
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [sidebar, setSidebar] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("Accueil");

  useEffect(() => {
    localStorage.setItem("m3u-favorites", JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => () => hlsRef.current?.destroy(), []);

  const groups = useMemo(
    () => ["Toutes", ...new Set(channels.map(c => c.group))],
    [channels]
  );

  const filtered = useMemo(() => channels.filter(c => {
    const matchesText = `${c.name} ${c.group}`
      .toLowerCase().includes(query.toLowerCase());
    const matchesGroup = group === "Toutes" || c.group === group;
    const matchesTab = activeTab !== "Favoris" ||
      favorites.includes(c.id);
    return matchesText && matchesGroup && matchesTab;
  }), [channels, query, group, activeTab, favorites]);

  function toggleFavorite(channel) {
    setFavorites(prev => prev.includes(channel.id)
      ? prev.filter(id => id !== channel.id)
      : [...prev, channel.id]);
  }

  function loadText(text) {
    const list = parseM3U(text);

    if (!list.length) {
      setError("Aucune chaîne valide trouvée dans ce fichier M3U.");
      return;
    }

    hlsRef.current?.destroy();
    setChannels(list);
    setGroup("Toutes");
    setQuery("");
    setError("");
    setCurrent(null);
    setActiveTab("TV en direct");
    play(list[0]);
  }

  function importFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => loadText(String(ev.target.result || ""));
    reader.readAsText(file);
    e.target.value = "";
  }

  async function importUrl() {
    if (!url.trim()) return;

    setLoading(true);
    setError("");

    try {
      const res = await fetch(url.trim());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      loadText(await res.text());
    } catch (e) {
      setError(
        `Impossible de charger la playlist : ${e.message}. Le serveur peut bloquer CORS.`
      );
    } finally {
      setLoading(false);
    }
  }

  function play(channel) {
    setCurrent(channel);
    setError("");

    const video = videoRef.current;
    if (!video) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;
    setLoading(true);

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = channel.url;
      video.play().then(() => setPlaying(true)).catch(() => {});
      setLoading(false);
      return;
    }

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30
      });

      hlsRef.current = hls;
      hls.loadSource(channel.url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().then(() => setPlaying(true)).catch(() => {});
        setLoading(false);
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          setLoading(false);
          setError(
            "Impossible de lire ce flux. Vérifie son URL et sa disponibilité."
          );
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          }
        }
      });
    } else {
      setLoading(false);
      setError("Ce navigateur ne prend pas en charge la lecture HLS.");
    }
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.play().then(() => setPlaying(true)).catch(() => {});
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }

  function changeVolume(e) {
    const value = Number(e.target.value);
    setVolume(value);

    if (videoRef.current) {
      videoRef.current.volume = value;
      videoRef.current.muted = value === 0;
    }

    setMuted(value === 0);
  }

  function reset() {
    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.removeAttribute("src");
      videoRef.current.load();
    }

    setChannels([]);
    setCurrent(null);
    setError("");
    setQuery("");
    setGroup("Toutes");
    setPlaying(false);
    setActiveTab("Accueil");
  }

  const navItems = [
    { name: "Accueil", icon: Home },
    { name: "TV en direct", icon: Tv },
    { name: "Films", icon: Film },
    { name: "Séries", icon: Clapperboard },
    { name: "Favoris", icon: Heart }
  ];

  return (
    <div className="app">
      <header className="topbar">
        <button
          className="mobileOnly secondary"
          onClick={() => setSidebar(!sidebar)}
          aria-label="Ouvrir le menu"
        >
          <Menu size={21} />
        </button>

        <button className="brand" onClick={() => setActiveTab("Accueil")}>
          <span className="brandIcon">🐅</span>
          <span>BLACK TEKSOU <b>LIVE TV</b></span>
        </button>

        <div className="headerSearch">
          <Search size={18} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher une chaîne..."
          />
        </div>

        <div className="topActions">
          <button onClick={() => fileRef.current?.click()}>
            <Upload size={17} /> Importer M3U
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".m3u,.m3u8,.txt"
            hidden
            onChange={importFile}
          />
          <button
            className="secondary"
            onClick={() => setShowSettings(!showSettings)}
            aria-label="Paramètres"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="settingsPanel">
          <b>Source de playlist</b>
          <div className="urlRow">
            <LinkIcon size={18} />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://exemple.com/playlist.m3u"
            />
            <button onClick={importUrl} disabled={loading}>
              {loading ? "Chargement..." : "Charger"}
            </button>
          </div>
          <small>
            Certaines playlists distantes peuvent être bloquées par CORS.
          </small>
        </div>
      )}

      <div className="layout">
        <aside className={`sidebar ${sidebar ? "open" : ""}`}>
          <div className="sidebarBrand">
            <span>🐅</span>
            <strong>BLACK TEKSOU</strong>
            <b>LIVE TV</b>
          </div>

          <nav className="navItems">
            {navItems.map(item => {
              const Icon = item.icon;

              return (
                <button
                  key={item.name}
                  className={activeTab === item.name ? "active" : ""}
                  onClick={() => {
                    setActiveTab(item.name);
                    setSidebar(false);
                    setGroup("Toutes");
                    if (item.name === "TV en direct" && !channels.length) {
                      fileRef.current?.click();
                    }
                  }}
                >
                  <Icon size={19} />
                  {item.name}
                </button>
              );
            })}
          </nav>

          <div className="sidebarBottom">
            <span>🐅</span>
            <p>Le meilleur du divertissement, au même endroit !</p>
          </div>
        </aside>

        <main className="mainContent">
          {activeTab === "Accueil" && (
            <>
              <section className="hero">
                <div className="heroContent">
                  <span className="heroBadge">
                    <Radio size={14} /> TON UNIVERS TV
                  </span>
                  <h1>
                    BLACK TEKSOU
                    <br />
                    <span>LIVE TV</span>
                  </h1>
                  <p>
                    Tes chaînes TV, films et séries préférés
                    <br />
                    au même endroit !
                  </p>
                  <button
                    className="heroButton"
                    onClick={() => {
                      if (channels.length) {
                        setActiveTab("TV en direct");
                      } else {
                        fileRef.current?.click();
                      }
                    }}
                  >
                    <Play size={18} fill="currentColor" />
                    {channels.length ? "Regarder maintenant" : "Importer ma playlist"}
                  </button>
                  <div className="heroFeatures">
                    <span>⚡ Lecture en direct</span>
                    <span>★ Favoris</span>
                    <span>📺 TV</span>
                  </div>
                </div>
                <div className="heroTiger" aria-hidden="true">🐅</div>
              </section>

              <section className="categoryGrid">
                {[
                  { name: "TV en direct", icon: Tv, desc: "Tes chaînes préférées" },
                  { name: "Films", icon: Film, desc: "Ton espace cinéma" },
                  { name: "Séries", icon: Clapperboard, desc: "Tes séries préférées" },
                  { name: "Favoris", icon: Heart, desc: "Tes sélections" }
                ].map(item => {
                  const Icon = item.icon;
                  return (
                    <button
                      className="categoryCard"
                      key={item.name}
                      onClick={() => {
                        setActiveTab(item.name);
                        if (item.name === "TV en direct" && !channels.length) {
                          fileRef.current?.click();
                        }
                      }}
                    >
                      <Icon size={26} />
                      <strong>{item.name}</strong>
                      <span>{item.desc}</span>
                      <ChevronRight size={17} />
                    </button>
                  );
                })}
              </section>
            </>
          )}

          {activeTab === "Films" && (
            <section className="pageIntro">
              <Film size={28} />
              <h1>Films</h1>
              <p>
                Ton espace cinéma. Les films ne sont pas fournis automatiquement :
                ajoute tes propres sources autorisées pour les afficher.
              </p>
            </section>
          )}

          {activeTab === "Séries" && (
            <section className="pageIntro">
              <Clapperboard size={28} />
              <h1>Séries</h1>
              <p>
                Retrouvez ici tes séries lorsque tu auras ajouté une source adaptée.
              </p>
            </section>
          )}

          {activeTab === "TV en direct" && (
            <section className="sectionBlock">
              <div className="sectionHeading">
                <div>
                  <Tv size={23} />
                  <h2>TV en direct</h2>
                </div>
                <span>{channels.length} chaîne(s)</span>
              </div>

              <div className="videoWrap">
                <video
                  ref={videoRef}
                  playsInline
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                />

                {!current && !loading && (
                  <div className="emptyPlayer">
                    <Tv size={42} />
                    <h2>Prêt à regarder ?</h2>
                    <p>Importe une playlist M3U pour commencer.</p>
                    <button onClick={() => fileRef.current?.click()}>
                      <Upload size={17} /> Importer M3U
                    </button>
                  </div>
                )}

                {loading && (
                  <div className="loader">
                    <RefreshCw className="spin" size={26} />
                    Connexion au flux...
                  </div>
                )}

                {error && <div className="errorBox">{error}</div>}

                {current && (
                  <div className="videoControls">
                    <button onClick={togglePlay} aria-label="Lecture ou pause">
                      {playing ? <Pause /> : <Play />}
                    </button>
                    <button onClick={toggleMute} aria-label="Son">
                      {muted ? <VolumeX /> : <Volume2 />}
                    </button>
                    <input
                      aria-label="Volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={muted ? 0 : volume}
                      onChange={changeVolume}
                    />
                    <span className="controlSpacer" />
                    <span className="liveBadge">● EN DIRECT</span>
                    <button
                      onClick={() => videoRef.current?.requestFullscreen?.()}
                      aria-label="Plein écran"
                    >
                      <Maximize />
                    </button>
                  </div>
                )}
              </div>

              {current && (
                <div className="nowPlaying">
                  <div>
                    <span className="eyebrow">EN LECTURE</span>
                    <h2>{current.name}</h2>
                    <span className="sub">{current.group}</span>
                  </div>
                  <button
                    className="favButton"
                    onClick={() => toggleFavorite(current)}
                  >
                    <Star
                      fill={favorites.includes(current.id) ? "currentColor" : "none"}
                    />
                    {favorites.includes(current.id)
                      ? "Dans mes favoris"
                      : "Ajouter aux favoris"}
                  </button>
                </div>
              )}
            </section>
          )}

          {(activeTab === "Accueil" || activeTab === "TV en direct" ||
            activeTab === "Favoris") && (
            <section className="sectionBlock">
              <div className="sectionHeading">
                <div>
                  {activeTab === "Favoris" ? <Heart size={23} /> : <Tv size={23} />}
                  <h2>
                    {activeTab === "Favoris"
                      ? "Mes favoris"
                      : activeTab === "Accueil"
                        ? "Chaînes TV en direct"
                        : "Toutes les chaînes"}
                  </h2>
                </div>
                <span>{filtered.length} résultat(s)</span>
              </div>

              {channels.length > 0 && (
                <div className="groups">
                  {groups.map(g => (
                    <button
                      key={g}
                      className={group === g ? "active" : ""}
                      onClick={() => setGroup(g)}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              )}

              <div className="channelGrid">
                {filtered.map(c => (
                  <button
                    className={`channelCard ${current?.id === c.id ? "selected" : ""}`}
                    key={c.id}
                    onClick={() => {
                      setActiveTab("TV en direct");
                      play(c);
                    }}
                  >
                    <div className="channelLogo">
                      {c.logo
                        ? <img src={c.logo} alt="" onError={e => {
                            e.currentTarget.style.display = "none";
                          }} />
                        : <Tv size={27} />}
                    </div>
                    <strong>{c.name}</strong>
                    <span>{c.group}</span>
                    <small><i /> Disponible dans la playlist</small>
                    <span
                      className="channelFavorite"
                      role="button"
                      onClick={e => {
                        e.stopPropagation();
                        toggleFavorite(c);
                      }}
                    >
                      <Star
                        size={17}
                        fill={favorites.includes(c.id) ? "currentColor" : "none"}
                      />
                    </span>
                  </button>
                ))}
              </div>

              {!filtered.length && (
                <div className="listEmpty">
                  <List size={32} />
                  <p>
                    {activeTab === "Favoris"
                      ? "Tu n'as pas encore de favoris."
                      : channels.length
                        ? "Aucun résultat."
                        : "Importe ta playlist M3U pour afficher tes chaînes."}
                  </p>
                  {!channels.length && (
                    <button onClick={() => fileRef.current?.click()}>
                      <Upload size={16} /> Importer M3U
                    </button>
                  )}
                </div>
              )}

              {channels.length > 0 && (
                <button className="clear" onClick={reset}>
                  <Trash2 size={16} /> Vider la playlist
                </button>
              )}
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
