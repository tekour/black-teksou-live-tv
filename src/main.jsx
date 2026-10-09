import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Hls from "hls.js";
import {
    Search,
    Upload,
    Link as LinkIcon,
    Star,
    StarOff,
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
    Radio,
    Settings,
    Trash2,
    Home,
Film,
Clapperboard,
Heart,
LayoutGrid,
} from "lucide-react";
import "./styles.css";

const SAMPLE = `#EXTM3U
#EXTINF:-1 tvg-id="demo1" tvg-name="Demo News" group-title="Démo",Demo News
https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8
#EXTINF:-1 tvg-id="demo2" tvg-name="Big Buck Bunny" group-title="Démo",Big Buck Bunny
https://test-streams.mux.dev/bbb-360p/bbb-360p.m3u8`;

function parseM3U(text) {
    const lines = text
        .split(/\r?\n/)
        .map((x) => x.trim())
        .filter(Boolean);
    const channels = [];
    for (let i = 0; i < lines.length; i++) {
        if (!lines[i].startsWith("#EXTINF")) continue;
        const info = lines[i];
        const url =
            lines[i + 1] && !lines[i + 1].startsWith("#") ? lines[i + 1] : "";
        if (!url) continue;
        const name = info.includes(",")
            ? info.slice(info.indexOf(",") + 1).trim()
            : "Chaîne";
        const attr = (key) => {
            const m = info.match(new RegExp(`${key}="([^"]*)"`));
            return m?.[1] || "";
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
    const [favorites, setFavorites] = useState(() =>
        JSON.parse(localStorage.getItem("m3u-favorites") || "[]"),
    );
    const [url, setUrl] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [sidebar, setSidebar] = useState(true);
    const [showSettings, setShowSettings] = useState(false);

    useEffect(() => {
        localStorage.setItem("m3u-favorites", JSON.stringify(favorites));
    }, [favorites]);

    useEffect(() => () => hlsRef.current?.destroy(), []);

    const groups = useMemo(
        () => ["Toutes", ...new Set(channels.map((c) => c.group))],
        [channels],
    );
    const filtered = useMemo(
        () =>
            channels.filter((c) => {
                const text = `${c.name} ${c.group}`.toLowerCase();
                const okText = text.includes(query.toLowerCase());
                const okGroup = group === "Toutes" || c.group === group;
                return okText && okGroup;
            }),
        [channels, query, group],
    );

    function toggleFavorite(channel) {
        setFavorites((prev) =>
            prev.includes(channel.id)
                ? prev.filter((id) => id !== channel.id)
                : [...prev, channel.id],
        );
    }

    function loadText(text) {
        const list = parseM3U(text);
        if (!list.length) {
            setError("Aucune chaîne valide trouvée dans ce fichier M3U.");
            return;
        }
        setChannels(list);
        setGroup("Toutes");
        setQuery("");
        setError("");
        setCurrent(list[0]);
    }

    function importFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => loadText(String(ev.target.result || ""));
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
                `Impossible de charger la playlist : ${e.message}. Le serveur peut bloquer CORS.`,
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
            video
                .play()
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
                video
                    .play()
                    .then(() => setPlaying(true))
                    .catch(() => {});
                setLoading(false);
            });
            hls.on(Hls.Events.ERROR, (_, data) => {
                if (data.fatal) {
                    setLoading(false);
                    setError(
                        "Le flux ne peut pas être lu. Vérifie l’URL, le CORS ou la disponibilité du flux.",
                    );
                    if (data.type === Hls.ErrorTypes.NETWORK_ERROR)
                        hls.startLoad();
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
        if (v.paused)
            v.play()
                .then(() => setPlaying(true))
                .catch(() => {});
        else {
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

    function fullscreen() {
        videoRef.current?.requestFullscreen?.();
    }

    function reset() {
        setChannels([]);
        setCurrent(null);
        setError("");
        setQuery("");
        setGroup("Toutes");
        hlsRef.current?.destroy();
        hlsRef.current = null;
        if (videoRef.current) videoRef.current.removeAttribute("src");
    }

    return (
        <div className="app">
            <header className="topbar">
                <span>BLACK TEKSOU LIVE TV 🐅🖤🟡</span>
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
                    >
                        <Settings size={17} />
                    </button>
                    <button
                        className="secondary mobileOnly"
                        onClick={() => setSidebar(!sidebar)}
                    >
                        <Menu size={18} />
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
                            onChange={(e) => setUrl(e.target.value)}
                            placeholder="https://exemple.com/playlist.m3u"
                        />
                        <button onClick={importUrl} disabled={loading}>
                            {loading ? "Chargement…" : "Charger"}
                        </button>
                    </div>
                    <small>
                        Astuce : les playlists distantes doivent autoriser les
                        requêtes CORS depuis votre navigateur.
                    </small>
                </div>
            )}

            <main className="layout">
                <section className="playerArea">
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
                                <h2>Votre télévision, en direct</h2>
                                <p>
                                    Importez une playlist M3U/M3U8 pour
                                    commencer.
                                </p>
                                <button
                                    onClick={() => fileRef.current?.click()}
                                >
                                    <Upload size={18} /> Importer une playlist
                                </button>
                            </div>
                        )}
                        {loading && (
                            <div className="loader">
                                <RefreshCw className="spin" size={32} />
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
                                <button onClick={togglePlay}>
                                    {playing ? <Pause /> : <Play />}
                                </button>
                                <button onClick={toggleMute}>
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
                                    <i /> LIVE
                                </span>
                                <button onClick={fullscreen}>
                                    <Maximize />
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="nowPlaying">
                        <div>
                            <span className="eyebrow">EN LECTURE</span>
                            <h1>
                                {current?.name || "Aucune chaîne sélectionnée"}
                            </h1>
                            {current && (
                                <span className="sub">{current.group}</span>
                            )}
                        </div>
                        {current && (
                            <button
                                className="favButton"
                                onClick={() => toggleFavorite(current)}
                            >
                                {favorites.includes(current.id) ? (
                                    <Star fill="currentColor" />
                                ) : (
                                    <Star />
                                )}{" "}
                                {favorites.includes(current.id)
                                    ? "Favori"
                                    : "Ajouter aux favoris"}
                            </button>
                        )}
                    </div>
                </section>

                <aside className={`sidebar ${sidebar ? "open" : ""}`}>
                    <div className="sidebarHead">
                        <div>
                            <h2>Chaînes</h2>
                            <span>{channels.length} disponibles</span>
                        </div>
                        <button
                            className="secondary mobileOnly"
                            onClick={() => setSidebar(false)}
                        >
                            <X />
                        </button>
                    </div>
                    <div className="search">
                        <Search size={17} />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Rechercher une chaîne…"
                        />
                    </div>
                    <div className="groups">
                        {groups.map((g) => (
                            <button
                                key={g}
                                className={group === g ? "active" : ""}
                                onClick={() => setGroup(g)}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                    <div className="channelList">
                        {!channels.length && (
                            <div className="listEmpty">
                                <List size={30} />
                                <p>Votre playlist apparaîtra ici.</p>
                                <button
                                    onClick={() => fileRef.current?.click()}
                                >
                                    Importer M3U
                                </button>
                            </div>
                        )}
                        {filtered.map((c) => (
                            <button
                                className={`channel ${
                                    current?.id === c.id ? "selected" : ""
                                }`}
                                key={c.id}
                                onClick={() => play(c)}
                            >
                                <div className="logo">
                                    {c.logo ? (
                                        <img
                                            src={c.logo}
                                            onError={(e) =>
                                                (e.currentTarget.style.display =
                                                    "none")
                                            }
                                        />
                                    ) : (
                                        <Tv size={20} />
                                    )}
                                </div>
                                <div className="channelText">
                                    <strong>{c.name}</strong>
                                    <span>{c.group}</span>
                                </div>
                                {favorites.includes(c.id) ? (
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
                        {channels.length > 0 && filtered.length === 0 && (
                            <div className="listEmpty">
                                <Search size={30} />
                                <p>Aucun résultat.</p>
                            </div>
                        )}
                    </div>
                    {channels.length > 0 && (
                        <button className="clear" onClick={reset}>
                            <Trash2 size={15} /> Vider la playlist
                        </button>
                    )}
                </aside>
            </main>
        </div>
    );
}

createRoot(document.getElementById("root")).render(<App />);
