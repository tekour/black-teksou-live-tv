import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Hls from "hls.js";
import {
    Search,
    Upload,
    Link as LinkIcon,
    Star,
    Play,
    Pause,
    Volume2,
    VolumeX,
    Maximize,
    RefreshCw,
    Tv,
    List,
    X,
    Menu,
    ChevronRight,
    Settings,
    Trash2,
    Home,
    Film,
    Clapperboard,
    Heart,
} from "lucide-react";
import "./styles.css";

function parseM3U(text) {
    const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const channels = [];

    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("#EXTINF")) continue;

        const info = lines[i];
        const url =
            lines[i + 1] && !lines[i + 1].startsWith("#")
                ? lines[i + 1]
                : "";

        if (!url) continue;

        const name = info.includes(",")
            ? info.slice(info.indexOf(",") + 1).trim()
            : "Chaîne";

        const attr = (key) => {
            const match = info.match(
                new RegExp(`${key}="([^"]*)"`)
            );
            return match?.[1] || "";
        };

        channels.push({
            id: `${attr("tvg-id") || name}-${url}`,
            name,
            url,
            group: attr("group-title") || "Autres",
            logo: attr("tvg-logo"),
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
            return JSON.parse(
                localStorage.getItem("m3u-favorites") || "[]"
            );
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
        localStorage.setItem(
            "m3u-favorites",
            JSON.stringify(favorites)
        );
    }, [favorites]);

    useEffect(() => {
        return () => hlsRef.current?.destroy();
    }, []);

    const groups = useMemo(
        () => [
            "Toutes",
            ...new Set(channels.map((channel) => channel.group)),
        ],
        [channels]
    );

    const filtered = useMemo(() => {
        return channels.filter((channel) => {
            const text =
                `${channel.name} ${channel.group}`.toLowerCase();

            const matchesSearch = text.includes(query.toLowerCase());
            const matchesGroup =
                group === "Toutes" || channel.group === group;

            return matchesSearch && matchesGroup;
        });
    }, [channels, query, group]);

    const visibleChannels = useMemo(() => {
        if (activeTab === "Favoris") {
            return filtered.filter((channel) =>
                favorites.includes(channel.id)
            );
        }

        if (activeTab === "Films") {
            return filtered.filter((channel) =>
                /film|movie|cin[eé]ma|vod/i.test(
                    `${channel.name} ${channel.group}`
                )
            );
        }

        if (activeTab === "Séries") {
            return filtered.filter((channel) =>
                /s[eé]rie|series|season|saison|episode|[eé]pisode/i.test(
                    `${channel.name} ${channel.group}`
                )
            );
        }

        return filtered;
    }, [filtered, activeTab, favorites]);

    function toggleFavorite(channel) {
        setFavorites((previous) =>
            previous.includes(channel.id)
                ? previous.filter((id) => id !== channel.id)
                : [...previous, channel.id]
        );
    }

    function loadText(text) {
        const list = parseM3U(text);

        if (!list.length) {
            setError(
                "Aucune chaîne valide trouvée dans ce fichier M3U."
            );
            return;
        }

        setChannels(list);
        setGroup("Toutes");
        setQuery("");
        setActiveTab("TV");
        setError("");
        setCurrent(list[0]);
    }

    function importFile(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (result) => {
            loadText(String(result.target.result || ""));
        };

        reader.readAsText(file);
        event.target.value = "";
    }

    async function importUrl() {
        if (!url.trim()) return;

        setLoading(true);
        setError("");

        try {
            const response = await fetch(url.trim());

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            loadText(await response.text());
        } catch (exception) {
            setError(
                `Impossible de charger la playlist : ${exception.message}. Le serveur peut bloquer CORS.`
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

            video.play()
                .then(() => setPlaying(true))
                .catch(() => {});

            setLoading(false);
            return;
        }

        if (Hls.isSupported()) {
            const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                backBufferLength: 30,
            });

            hlsRef.current = hls;
            hls.loadSource(channel.url);
            hls.attachMedia(video);

            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play()
                    .then(() => setPlaying(true))
                    .catch(() => {});

                setLoading(false);
            });

            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    setLoading(false);
                    setError(
                        "Le flux ne peut pas être lu. Vérifie l’URL ou la disponibilité du flux."
                    );

                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                        hls.startLoad();
                    }
                }
            });
        } else {
            setLoading(false);
            setError(
                "Ce navigateur ne prend pas en charge la lecture HLS."
            );
        }
    }

    function togglePlay() {
        const video = videoRef.current;
        if (!video) return;

        if (video.paused) {
            video.play()
                .then(() => setPlaying(true))
                .catch(() => {});
        } else {
            video.pause();
            setPlaying(false);
        }
    }

    function toggleMute() {
        const video = videoRef.current;
        if (!video) return;

        video.muted = !video.muted;
        setMuted(video.muted);
    }

    function changeVolume(event) {
        const value = Number(event.target.value);

        setVolume(value);

        if (videoRef.current) {
            videoRef.current.volume = value;
            videoRef.current.muted = value === 0;
        }

        setMuted(value === 0);
    }

    function fullscreen() {
        videoRef.current?.requestFullscreen?.();
    }

    function reset() {
        setChannels([]);
        setCurrent(null);
        setError("");
        setQuery("");
        setGroup("Toutes");
        setActiveTab("Accueil");

        hlsRef.current?.destroy();
        hlsRef.current = null;

        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.removeAttribute("src");
            videoRef.current.load();
        }

        setPlaying(false);
    }

    const navigation = [
        { name: "Accueil", icon: Home },
        { name: "TV", icon: Tv },
        { name: "Films", icon: Film },
        { name: "Séries", icon: Clapperboard },
        { name: "Favoris", icon: Heart },
    ];

    const tabDescriptions = {
        Accueil: "Retrouve tes contenus au même endroit.",
        TV: "Toutes les chaînes de ta playlist.",
        Films: "Les films disponibles dans ta playlist.",
        Séries: "Les séries disponibles dans ta playlist.",
        Favoris: "Tes chaînes et contenus préférés.",
    };

    return (
        <div className="app">
            <header className="topbar">
                <span>BLACK TEKSOU LIVE TV 🐅🖤🟡</span>

                <div className="topActions">
                    <button onClick={() => fileRef.current?.click()}>
                        <Upload size={17} />
                        Importer M3U
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
                        <Settings size={17} />
                    </button>

                    <button
                        className="secondary mobileOnly"
                        onClick={() => setSidebar(!sidebar)}
                        aria-label="Afficher les chaînes"
                    >
                        <Menu size={18} />
                    </button>
                </div>
            </header>

            <nav className="mainNav" aria-label="Navigation principale">
                {navigation.map(({ name, icon: Icon }) => (
                    <button
                        key={name}
                        className={
                            activeTab === name
                                ? "navItem active"
                                : "navItem"
                        }
                        onClick={() => {
                            setActiveTab(name);
                            setQuery("");
                            setGroup("Toutes");
                        }}
                    >
                        <Icon size={18} />
                        <span>{name}</span>
                    </button>
                ))}
            </nav>

            {showSettings && (
                <div className="settingsPanel">
                    <b>Source de playlist</b>

                    <div className="urlRow">
                        <LinkIcon size={18} />

                        <input
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="Adresse de la playlist M3U"
                        />

                        <button onClick={importUrl} disabled={loading}>
                            {loading ? "Chargement…" : "Charger"}
                        </button>
                    </div>

                    <small>
                        Les playlists distantes doivent autoriser les
                        requêtes CORS depuis ton navigateur.
                    </small>
                </div>
            )}

            <main className="layout">
                <section className="playerArea">
                    <div className="pageIntro">
                        <div>
                            <span className="eyebrow">
                                BLACK TEKSOU ORIGINAL
                            </span>
                            <h2>{activeTab}</h2>
                            <p>{tabDescriptions[activeTab]}</p>
                        </div>
                    </div>

                    <div className="videoWrap">
                        <video
                            ref={videoRef}
                            playsInline
                            onPlay={() => setPlaying(true)}
                            onPause={() => setPlaying(false)}
                        />

                        {!current && (
                            <div className="emptyPlayer">
                                <div className="bigIcon">
                                    <Tv size={44} />
                                </div>

                                <h2>
                                    Ta télévision, ton univers
                                </h2>

                                <p>
                                    Importe ta playlist M3U/M3U8 pour
                                    commencer à regarder.
                                </p>

                                <button
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <Upload size={18} />
                                    Importer une playlist
                                </button>
                            </div>
                        )}

                        {loading && (
                            <div className="loader">
                                <RefreshCw
                                    className="spin"
                                    size={32}
                                />
                                <span>Connexion au flux…</span>
                            </div>
                        )}

                        {error && (
                            <div className="errorBox">
                                <X size={18} />
                                {error}
                            </div>
                        )}

                        {current && (
                            <div className="videoControls">
                                <button
                                    onClick={togglePlay}
                                    aria-label={
                                        playing ? "Pause" : "Lecture"
                                    }
                                >
                                    {playing ? <Pause /> : <Play />}
                                </button>

                                <button
                                    onClick={toggleMute}
                                    aria-label="Son"
                                >
                                    {muted ? <VolumeX /> : <Volume2 />}
                                </button>

                                <input
                                    aria-label="Volume"
                                    type="range"
                                    min="0"
                                    max="1"
                                    step=".05"
                                    value={muted ? 0 : volume}
                                    onChange={changeVolume}
                                />

                                <div className="controlSpacer" />

                                <span className="liveBadge">
                                    <i />
                                    LIVE
                                </span>

                                <button
                                    onClick={fullscreen}
                                    aria-label="Plein écran"
                                >
                                    <Maximize />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="nowPlaying">
                        <div>
                            <span className="eyebrow">EN LECTURE</span>

                            <h1>
                                {current?.name ||
                                    "Aucun contenu sélectionné"}
                            </h1>

                            {current && (
                                <span className="sub">
                                    {current.group}
                                </span>
                            )}
                        </div>

                        {current && (
                            <button
                                className="favButton"
                                onClick={() => toggleFavorite(current)}
                            >
                                <Star
                                    fill={
                                        favorites.includes(current.id)
                                            ? "currentColor"
                                            : "none"
                                    }
                                />

                                {favorites.includes(current.id)
                                    ? "Dans mes favoris"
                                    : "Ajouter aux favoris"}
                            </button>
                        )}
                    </div>

                    {activeTab === "Accueil" && (
                        <section className="homeWelcome">
                            <h2>Bienvenue sur BLACK TEKSOU</h2>
                            <p>
                                Ton espace de divertissement. Importe
                                ta playlist puis choisis une catégorie
                                dans le menu.
                            </p>

                            <div className="homeActions">
                                <button
                                    onClick={() => setActiveTab("TV")}
                                >
                                    <Tv size={18} />
                                    Voir les chaînes
                                </button>

                                <button
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <Upload size={18} />
                                    Importer M3U
                                </button>
                            </div>
                        </section>
                    )}
                </section>

                <aside
                    className={`sidebar ${sidebar ? "open" : ""}`}
                >
                    <div className="sidebarHead">
                        <div>
                            <h2>
                                {activeTab === "Favoris"
                                    ? "Mes favoris"
                                    : activeTab === "Films"
                                      ? "Films"
                                      : activeTab === "Séries"
                                        ? "Séries"
                                        : "Chaînes"}
                            </h2>

                            <span>
                                {visibleChannels.length} disponible(s)
                            </span>
                        </div>

                        <button
                            className="secondary mobileOnly"
                            onClick={() => setSidebar(false)}
                            aria-label="Fermer la liste"
                        >
                            <X />
                        </button>
                    </div>

                    <div className="search">
                        <Search size={17} />

                        <input
                            value={query}
                            onChange={(event) =>
                                setQuery(event.target.value)
                            }
                            placeholder="Rechercher…"
                        />
                    </div>

                    {activeTab !== "Favoris" && (
                        <div className="groups">
                            {groups.map((item) => (
                                <button
                                    key={item}
                                    className={
                                        group === item ? "active" : ""
                                    }
                                    onClick={() => setGroup(item)}
                                >
                                    {item}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="channelList">
                        {!channels.length && (
                            <div className="listEmpty">
                                <List size={30} />

                                <p>
                                    Ta playlist apparaîtra ici après
                                    l’importation.
                                </p>

                                <button
                                    onClick={() => fileRef.current?.click()}
                                >
                                    Importer M3U
                                </button>
                            </div>
                        )}

                        {channels.length > 0 &&
                            visibleChannels.map((channel) => (
                                <button
                                    className={`channel ${
                                        current?.id === channel.id
                                            ? "selected"
                                            : ""
                                    }`}
                                    key={channel.id}
                                    onClick={() => {
                                        play(channel);
                                        setSidebar(false);
                                    }}
                                >
                                    <div className="logo">
                                        {channel.logo ? (
                                            <img
                                                src={channel.logo}
                                                alt=""
                                                onError={(event) => {
                                                    event.currentTarget.style.display =
                                                        "none";
                                                }}
                                            />
                                        ) : (
                                            <Tv size={20} />
                                        )}
                                    </div>

                                    <div className="channelText">
                                        <strong>{channel.name}</strong>
                                        <span>{channel.group}</span>
                                    </div>

                                    {favorites.includes(channel.id) ? (
                                        <Star
                                            size={15}
                                            fill="currentColor"
                                            className="star"
                                        />
                                    ) : (
                                        <ChevronRight size={17} />
                                    )}
                                </button>
                            ))}

                        {channels.length > 0 &&
                            visibleChannels.length === 0 && (
                                <div className="listEmpty">
                                    <Search size={30} />

                                    <p>
                                        Aucun résultat dans cette catégorie.
                                    </p>

                                    {activeTab === "Films" ||
                                    activeTab === "Séries" ? (
                                        <small>
                                            Vérifie que ta playlist contient
                                            des groupes ou des noms de films
                                            ou de séries reconnus.
                                        </small>
                                    ) : null}
                                </div>
                            )}
                    </div>

                    {channels.length > 0 && (
                        <button className="clear" onClick={reset}>
                            <Trash2 size={15} />
                            Vider la playlist
                        </button>
                    )}
                </aside>
            </main>
        </div>
    );
}

createRoot(document.getElementById("root")).render(<App />);
