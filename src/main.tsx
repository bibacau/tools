import {
  initializeNavigation,
  navigateTo,
  canReturn,
  returnToPreviousPage,
} from "./navigation";
import { appFetch, nativeApp } from "./platform";
import React, { useState, useEffect, useRef, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Grid2X2,
  Star,
  History,
  Settings,
  Search,
  PanelLeftClose,
  ArrowUpRight,
  ArrowLeft,
  ChevronRight,
  Check,
  Cloud,
  Plus,
  Menu,
  X,
  LogOut,
  ShieldCheck,
  HardDrive,
  ArrowDownToLine,
} from "lucide-react";
import { tools } from "./catalog";
import * as store from "./store";
import { download } from "./utils";
import "./style.css";
const Tool = lazy(() => import("./tools"));
function App() {
  const [ready, setReady] = useState(false),
    [auth, setAuth] = useState(false),
    [setup, setSetup] = useState(false),
    [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [page, setPage] = useState(
      ["ip", "currency"].includes(location.pathname.slice(1))
        ? "all"
        : location.pathname.slice(1) || "dashboard",
    ),
    [query, setQuery] = useState(""),
    [palette, setPalette] = useState(false),
    [mobile, setMobile] = useState(false),
    [, refresh] = useState(0),
    [online, setOnline] = useState(navigator.onLine),
    [category, setCategory] = useState("All tools"),
    [collapsed, setCollapsed] = useState(false),
    [install, setInstall] = useState<any>(null);
  const backRef = useRef<() => void>(() => {});
  backRef.current = () => {
    if (palette) {
      setPalette(false);
      return;
    }
    if (mobile) {
      setMobile(false);
      return;
    }
    returnToPreviousPage();
  };
  useEffect(() => {
    if (!nativeApp) return;
    const listener = import("@capacitor/app").then(({ App }) =>
      App.addListener("backButton", () => backRef.current()),
    );
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, []);
  useEffect(() => {
    initializeNavigation();
    const off = store.subscribe(() => refresh((x) => x + 1));
    store.init().then(() => setReady(true));
    appFetch("/api/auth")
      .then((r) => r.json())
      .then((v) => {
        setAuth(v.authenticated);
        setSetup(v.setup);
        if (v.authenticated) {
          localStorage.setItem("authorized", "yes");
          void store.sync();
        }
      })
      .catch(() => {
        if (localStorage.getItem("authorized")) setAuth(true);
      });
    const pop = () => {
      setPage(location.pathname.slice(1) || "dashboard");
      setPalette(false);
      setMobile(false);
      setQuery("");
      window.scrollTo(0, 0);
    };
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setPalette((v) => !v);
      }
      if (e.key === "Escape") setPalette(false);
    };
    const net = () => {
      setOnline(navigator.onLine);
      void store.sync();
    };
    const focus = () => void store.sync();
    const prompt = (e: Event) => {
      e.preventDefault();
      setInstall(e);
    };
    window.addEventListener("popstate", pop);
    window.addEventListener("keydown", key);
    window.addEventListener("online", net);
    window.addEventListener("offline", net);
    window.addEventListener("focus", focus);
    window.addEventListener("beforeinstallprompt", prompt);
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void store.sync();
    }, 60000);
    if ("serviceWorker" in navigator && import.meta.env.PROD && !nativeApp)
      navigator.serviceWorker.register("/sw.js");
    return () => {
      off();
      clearInterval(interval);
      window.removeEventListener("popstate", pop);
      window.removeEventListener("keydown", key);
      window.removeEventListener("online", net);
      window.removeEventListener("offline", net);
      window.removeEventListener("focus", focus);
      window.removeEventListener("beforeinstallprompt", prompt);
    };
  }, []);
  const prefs = store.get("preferences") || {
    type: "preferences",
    favorites: ["notes", "units", "wheel"],
    theme: "dark",
    external: false,
    widgets: ["favorites", "tools", "activity"],
  };
  useEffect(() => {
    document.documentElement.dataset.theme =
      prefs.theme === "system"
        ? matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark"
        : prefs.theme;
    document.documentElement.style.setProperty(
      "--accent",
      prefs.theme === "cozy-forest" ? "#a65d36" : prefs.accent || "#9c8bff",
    );
    document.documentElement.dataset.motion =
      prefs.motion === false ? "off" : "on";
  }, [prefs.theme, prefs.accent, prefs.motion]);
  const savePrefs = (v: any) =>
    void store.put("preferences", { ...prefs, ...v });
  const favorite = (id: string) =>
    savePrefs({
      favorites: prefs.favorites
        .filter((id: string) => tools.some((t) => t.id === id))
        .includes(id)
        ? prefs.favorites.filter((x: string) => x !== id)
        : [...prefs.favorites, id],
    });
  function go(id: string) {
    navigateTo(id);
    setPage(id);
    setPalette(false);
    setMobile(false);
    setQuery("");
    if (tools.some((t) => t.id === id))
      void store.put("recent-" + id, { type: "recent", tool: id });
    window.scrollTo(0, 0);
  }
  async function login(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await appFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const v = await r.json();
      if (!r.ok) throw Error(v.error);
      localStorage.setItem("authorized", "yes");
      setAuth(true);
      setMobile(false);
      setPalette(false);
      setSetup(false);
      setPassword("");
      void store.sync();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  if (!ready) return <div className="splash">Opening your space…</div>;
  if (!auth)
    return (
      <div className="login">
        <div className="brand-mark">
          <Grid2X2 />
        </div>
        <span className="eyebrow">YOUR SPACE. YOUR PACE.</span>
        <h1>
          Welcome to Personal OS<span>.</span>
        </h1>
        <p>Your everyday tools, together in one private space.</p>
        <form className="panel" onSubmit={login}>
          <ShieldCheck />
          <h2>{setup ? "Make yourself at home" : "Welcome back"}</h2>
          <p>
            {setup
              ? "Create your private account with a password of at least 8 letters or numbers."
              : "Enter your password to open your workspace."}
          </p>
          <label>
            Password
            <input
              type="password"
              minLength={setup ? 8 : 1}
              pattern={setup ? "[A-Za-z0-9]{8,200}" : undefined}
              maxLength={200}
              required
              autoComplete={setup ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <button className="primary">
            {setup ? "Create my workspace" : "Unlock workspace"}{" "}
            <ArrowUpRight size={16} />
          </button>
          {error && (
            <p role="alert" className="error">
              {error}
            </p>
          )}
          <small>
            After signing in, cached data stays accessible offline on this
            device. Use a trusted device.
          </small>
        </form>
      </div>
    );
  const current = tools.find((t) => t.id === page),
    filtered = tools.filter(
      (t) =>
        (t.name + " " + t.description)
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (category === "All tools" || category === t.category),
    );
  const notes = store
      .list("note")
      .sort((a, b) => b.data.updated - a.data.updated),
    records = store
      .list("record")
      .sort((a, b) => b.data.updated - a.data.updated);
  const cards = (items: typeof tools) => (
    <div className="tool-grid">
      {items.map((t) => (
        <article className="tool-card" key={t.id}>
          <button
            className={
              "favorite " +
              (prefs.favorites
                .filter((id: string) => tools.some((t) => t.id === id))
                .includes(t.id)
                ? "selected"
                : "")
            }
            aria-label={"Favorite " + t.name}
            onClick={() => favorite(t.id)}
          >
            <Star
              size={15}
              fill={
                prefs.favorites
                  .filter((id: string) => tools.some((t) => t.id === id))
                  .includes(t.id)
                  ? "currentColor"
                  : "none"
              }
            />
          </button>
          <button className="card-link" onClick={() => go(t.id)}>
            <div className={"tool-icon " + t.color}>
              <t.icon size={23} />
            </div>
            <h3>{t.name}</h3>
            <p>{t.description}</p>
            <div className="card-bottom">
              <span>{t.category}</span>
              <ArrowUpRight size={17} />
            </div>
          </button>
        </article>
      ))}
    </div>
  );
  const widgets: Record<string, React.ReactNode> = {
    favorites: (
      <section>
        <div className="section-heading">
          <h2>
            <Star size={17} /> Your favorites{" "}
            <span>
              {
                prefs.favorites.filter((id: string) =>
                  tools.some((t) => t.id === id),
                ).length
              }
            </span>
          </h2>
          <button className="text-button" onClick={() => go("favorites")}>
            Manage favorites <ChevronRight size={15} />
          </button>
        </div>
        {cards(
          tools.filter((t) =>
            prefs.favorites
              .filter((id: string) => tools.some((t) => t.id === id))
              .includes(t.id),
          ),
        )}
      </section>
    ),
    tools: (
      <section>
        <div className="section-heading">
          <h2>
            Your everyday toolkit <span>{tools.length} tools</span>
          </h2>
          <span className="subtle">Little tools. Endless possibilities.</span>
        </div>
        <div className="filters">
          {["All tools", "Productivity", "Utilities", "Play & Practice"].map(
            (c) => (
              <button
                key={c}
                className={category === c ? "active" : ""}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ),
          )}
        </div>
        {cards(filtered)}
      </section>
    ),
    activity: (
      <section className="activity-grid">
        <div className="panel">
          <div className="section-heading">
            <h2>Recent notes</h2>
            <button className="text-button" onClick={() => go("notes")}>
              Open notes <ArrowUpRight size={15} />
            </button>
          </div>
          {notes.slice(0, 3).map((n) => (
            <button
              className="activity-row"
              key={n.id}
              onClick={() => go("notes")}
            >
              <span className="mini-icon">✎</span>
              <span>
                {n.data.title || "Untitled note"}
                <small>{new Date(n.data.updated).toLocaleDateString()}</small>
              </span>
              <ChevronRight size={16} />
            </button>
          ))}
          {!notes.length && (
            <div className="empty">
              <p>A fresh page is waiting.</p>
              <button
                onClick={() => {
                  store.create("note", {
                    title: "A new thought",
                    body: "",
                    tags: "",
                    folder: "",
                  });
                  go("notes");
                }}
              >
                Write your first note <Plus size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="panel">
          <div className="section-heading">
            <h2>Your latest records</h2>
            <History size={17} />
          </div>
          {records.slice(0, 3).map((r) => (
            <div className="activity-row" key={r.id}>
              <span className="mini-icon">↗</span>
              <span>
                {r.data.name}
                <small>{new Date(r.data.updated).toLocaleString()}</small>
              </span>
              <strong>{r.data.value}</strong>
            </div>
          ))}
          {!records.length && (
            <div className="empty">
              <p>A personal best starts with a first try.</p>
              <button onClick={() => go("reaction")}>
                Try reaction time <ArrowUpRight size={14} />
              </button>
            </div>
          )}
        </div>
      </section>
    ),
  };
  return (
    <div className={"app " + (collapsed ? "collapsed" : "")}>
      <aside className={mobile ? "open" : ""}>
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            go("dashboard");
          }}
        >
          <span className="brand-mark">
            <Grid2X2 size={21} />
          </span>
          <b>
            Personal<span>OS</span>
            <small>YOUR EVERYDAY, SIMPLIFIED</small>
          </b>
        </a>
        <button
          className="mobile-close"
          onClick={() => setMobile(false)}
          aria-label="Close menu"
        >
          <X />
        </button>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {[
            { id: "dashboard", name: "Dashboard", icon: LayoutDashboard },
            { id: "all", name: "All Tools", icon: Grid2X2 },
            { id: "favorites", name: "Favorites", icon: Star },
            { id: "history", name: "History & Records", icon: History },
          ].map((n) => (
            <button
              key={n.id}
              className={page === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={18} />
              <span>{n.name}</span>
              {n.id === "all" && <small>{tools.length}</small>}
            </button>
          ))}
        </nav>
        <div className="nav-label tools-nav-label">
          PINNED TOOLS <span>✧</span>
        </div>
        <nav className="pinned">
          {tools
            .filter((t) =>
              prefs.favorites
                .filter((id: string) => tools.some((t) => t.id === id))
                .includes(t.id),
            )
            .map((t) => (
              <button
                key={t.id}
                onClick={() => go(t.id)}
                className={page === t.id ? "active" : ""}
              >
                <t.icon size={17} />
                <span>{t.name}</span>
              </button>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="private-box">
            <ShieldCheck size={20} />
            <b>Just you and your tools.</b>
            <p>
              Private by design.
              <br />
              Ready wherever life takes you.
            </p>
            <span>
              <i /> Offline-ready workspace
            </span>
          </div>
          <nav>
            <button
              className={page === "settings" ? "active" : ""}
              onClick={() => go("settings")}
            >
              <Settings size={18} />
              <span>Settings</span>
            </button>
            <button onClick={() => setCollapsed(!collapsed)}>
              <PanelLeftClose size={18} />
              <span>Collapse sidebar</span>
            </button>
          </nav>
          <div className="profile">
            <div>P</div>
            <span>
              Personal workspace<small>Your own little corner</small>
            </span>
            <button
              aria-label={nativeApp ? "Lock app" : "Log out and clear device"}
              onClick={async () => {
                await appFetch("/api/logout", { method: "POST" }).catch(
                  () => {},
                );
                if (!nativeApp) await store.clearLocal();
                setAuth(false);
              }}
            >
              {" "}
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
      {mobile && <div className="scrim" onClick={() => setMobile(false)} />}
      <main>
        <header>
          <div className="breadcrumb">
            <button
              className="return-button"
              aria-label="Go back"
              title="Return to previous page"
              disabled={!canReturn() && !palette && !mobile}
              onClick={() => backRef.current()}
            >
              <ArrowLeft size={18} />
            </button>
            <button
              className="mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu />
            </button>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <b>
              {current?.name ||
                (
                  {
                    dashboard: "Dashboard",
                    all: "All Tools",
                    favorites: "Favorites",
                    history: "History & Records",
                    settings: "Settings",
                  } as any
                )[page] ||
                "Dashboard"}
            </b>
          </div>
          <div className="header-actions">
            <span className="connection">
              <i className={online ? "" : "offline"} />
              {online ? "Local-first" : "Offline"}
            </span>
            <button className="search-trigger" onClick={() => setPalette(true)}>
              <Search size={16} />
              <span>Quick search</span>
              <kbd>⌘ K</kbd>
            </button>
            <div className="avatar">P</div>
          </div>
        </header>
        <div className="content">
          {page === "dashboard" && (
            <>
              <div className="welcome">
                <div>
                  <span className="eyebrow">
                    A LITTLE MORE FOCUS. A LITTLE LESS FRICTION.
                  </span>
                  <h1>
                    Your everyday, simplified<span>.</span>
                  </h1>
                  <p>
                    One space for your ideas, your tasks, and a little bit of
                    play.
                  </p>
                </div>
                <div className="date-box">
                  <span>
                    {new Date().toLocaleDateString(undefined, {
                      weekday: "long",
                    })}
                  </span>
                  <b>
                    {new Date().toLocaleDateString(undefined, {
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </b>
                </div>
              </div>
              <div className="hero-search">
                <Search size={20} />
                <input
                  placeholder="What would you like to do today?"
                  aria-label="Search tools"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => setPalette(true)}
                />
                <kbd>⌘ K</kbd>
              </div>
              <div className="overview">
                <div>
                  <span className="overview-icon violet">
                    <Grid2X2 size={18} />
                  </span>
                  <span>
                    <b>{tools.length}</b>
                    <small>Handy tools</small>
                  </span>
                </div>
                <div>
                  <span className="overview-icon amber">
                    <Star size={18} />
                  </span>
                  <span>
                    <b>
                      {prefs.favorites
                        .filter((id: string) => tools.some((t) => t.id === id))
                        .length.toString()
                        .padStart(2, "0")}
                    </b>
                    <small>Your favorites</small>
                  </span>
                </div>
                <div>
                  <span className="overview-icon teal">
                    <HardDrive size={18} />
                  </span>
                  <span>
                    <b>{notes.length.toString().padStart(2, "0")}</b>
                    <small>Saved notes</small>
                  </span>
                </div>
                <div>
                  <span className="overview-icon blue">
                    <ShieldCheck size={18} />
                  </span>
                  <span>
                    <b>100% yours</b>
                    <small>Private & local-first</small>
                  </span>
                </div>
              </div>
              {(prefs.widgets || ["favorites", "tools", "activity"]).map(
                (w: string) => (
                  <React.Fragment key={w}>{widgets[w]}</React.Fragment>
                ),
              )}
              {store
                .list("recent")
                .filter((r) => tools.some((t) => t.id === r.data.tool)).length >
                0 && (
                <section>
                  <div className="section-heading">
                    <h2>Recently opened</h2>
                  </div>
                  <div className="chips">
                    {store
                      .list("recent")
                      .filter((r) => tools.some((t) => t.id === r.data.tool))
                      .sort((a, b) => b.data.updated - a.data.updated)
                      .slice(0, 5)
                      .map((r) => (
                        <button key={r.id} onClick={() => go(r.data.tool)}>
                          {tools.find((t) => t.id === r.data.tool)?.name}
                          <ArrowUpRight size={14} />
                        </button>
                      ))}
                  </div>
                </section>
              )}
              {store.list("wheel").length > 0 && (
                <section>
                  <h2>Saved wheels</h2>
                  <div className="chips">
                    {store.list("wheel").map((r) => (
                      <button key={r.id} onClick={() => go("wheel")}>
                        {r.data.name}
                        <ArrowUpRight size={14} />
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
          {["all", "favorites"].includes(page) && (
            <>
              <div className="page-title">
                <span className="eyebrow">YOUR PERSONAL TOOLKIT</span>
                <h1>
                  {page === "all"
                    ? "A tool for every little thing."
                    : "Keep your go-tos close."}
                </h1>
                <p>Thoughtfully simple. Always within reach.</p>
              </div>
              <div className="hero-search">
                <Search size={19} />
                <input
                  placeholder="Find a tool…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              {cards(
                filtered.filter(
                  (t) =>
                    page !== "favorites" ||
                    prefs.favorites
                      .filter((id: string) => tools.some((t) => t.id === id))
                      .includes(t.id),
                ),
              )}
            </>
          )}
          {current && (
            <>
              <div className="tool-title">
                <div className={"tool-icon " + current.color}>
                  <current.icon />
                </div>
                <div>
                  <span className="eyebrow">{current.category}</span>
                  <h1>{current.name}</h1>
                  <p>{current.description}</p>
                </div>
                <button
                  className="icon-button"
                  onClick={() => favorite(current.id)}
                  aria-label="Toggle favorite"
                >
                  <Star
                    fill={
                      prefs.favorites
                        .filter((id: string) => tools.some((t) => t.id === id))
                        .includes(current.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>
              </div>
              <Suspense fallback={<div className="panel">Opening tool…</div>}>
                <Tool id={current.id} prefs={prefs} />
              </Suspense>
            </>
          )}
          {page === "history" && (
            <>
              <h1>History & records</h1>
              <p className="subtle">Your progress, one little win at a time.</p>
              {records.length === 0 ? (
                <div className="panel empty">
                  Your records will appear after using a test or spinning a
                  wheel.
                </div>
              ) : (
                records.map((r) => (
                  <div className="panel activity-row" key={r.id}>
                    <span>
                      {r.data.name}
                      <small>{new Date(r.data.updated).toLocaleString()}</small>
                    </span>
                    <strong>{r.data.value}</strong>
                    <button onClick={() => store.remove(r.id)}>Delete</button>
                  </div>
                ))
              )}
            </>
          )}
          {page === "settings" && (
            <>
              <h1>Make it your space.</h1>
              <p className="subtle">
                A few small preferences. A workspace that feels like you.
              </p>
              <div className="settings-grid">
                <section className="panel">
                  <h2>Appearance</h2>
                  <label>
                    Theme
                    <select
                      value={prefs.theme}
                      onChange={(e) => savePrefs({ theme: e.target.value })}
                    >
                      {["dark", "light", "system", "cozy-forest"].map((x) => (
                        <option key={x} value={x}>
                          {x === "cozy-forest" ? "Cozy forest" : x}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Accent color
                    <input
                      type="color"
                      value={prefs.accent || "#9c8bff"}
                      onChange={(e) => savePrefs({ accent: e.target.value })}
                    />
                  </label>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={prefs.motion !== false}
                      onChange={(e) => savePrefs({ motion: e.target.checked })}
                    />
                    Enable animations
                  </label>
                  <h3>Dashboard arrangement</h3>
                  {(prefs.widgets || ["favorites", "tools", "activity"]).map(
                    (w: string, i: number) => (
                      <div className="activity-row" key={w}>
                        <span>{w}</span>
                        <button
                          disabled={!i}
                          onClick={() => {
                            const v = [
                              ...(prefs.widgets || [
                                "favorites",
                                "tools",
                                "activity",
                              ]),
                            ];
                            [v[i - 1], v[i]] = [v[i], v[i - 1]];
                            savePrefs({ widgets: v });
                          }}
                        >
                          Move up ↑
                        </button>
                      </div>
                    ),
                  )}
                </section>
                <section className="panel">
                  <h2>Account password</h2>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.currentTarget;
                      const fields = new FormData(form);
                      try {
                        const response = await appFetch("/api/password", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            currentPassword: fields.get("currentPassword"),
                            newPassword: fields.get("newPassword"),
                          }),
                        });
                        const result = await response.json();
                        if (!response.ok) throw Error(result.error);
                        form.reset();
                        alert("Password updated.");
                      } catch (error) {
                        alert((error as Error).message);
                      }
                    }}
                  >
                    <label>
                      Current password
                      <input
                        name="currentPassword"
                        type="password"
                        autoComplete="current-password"
                        required
                        maxLength={200}
                      />
                    </label>
                    <label>
                      New password · at least 8 letters or numbers
                      <input
                        name="newPassword"
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={200}
                        pattern="[A-Za-z0-9]{8,200}"
                      />
                    </label>
                    <button>Update password</button>
                  </form>
                  <hr />
                  <h2>Privacy & offline storage</h2>
                  {nativeApp && (
                    <p className="subtle">
                      Standalone Android app. Records are saved on this device;
                      no server sync. Locking preserves records. Uninstalling or
                      clearing app data deletes them, so export backups first.
                      This app lock does not encrypt stored records.
                    </p>
                  )}
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={prefs.external}
                      onChange={(e) =>
                        savePrefs({ external: e.target.checked })
                      }
                    />
                    Allow optional internet features
                  </label>
                  <p className="subtle">
                    Off by default. Enable this to download the
                    background-removal model when you request processing. Images
                    remain on your device. Audio never goes to a third party.
                  </p>
                  <p>{store.syncState}</p>
                  <small>
                    Last sync:{" "}
                    {store.lastSync
                      ? new Date(store.lastSync).toLocaleString()
                      : "Not yet synchronized"}
                  </small>
                  <div className="actions">
                    <button onClick={() => void store.sync()}>Sync now</button>
                    <button
                      onClick={() =>
                        navigator.storage
                          ?.persist()
                          .then((v) =>
                            alert(
                              v
                                ? "Persistent storage granted"
                                : "Browser may clear storage under pressure",
                            ),
                          )
                      }
                    >
                      Keep storage
                    </button>
                    <button
                      onClick={() =>
                        navigator.storage
                          ?.estimate()
                          .then((v) =>
                            alert(
                              `${((v.usage || 0) / 1048576).toFixed(2)} MB used; ${((v.quota || 0) / 1048576).toFixed(0)} MB quota`,
                            ),
                          )
                      }
                    >
                      Storage usage
                    </button>
                  </div>
                  {install && (
                    <button onClick={() => install.prompt()}>
                      Install Personal OS
                    </button>
                  )}
                  <p className="subtle">
                    Offline access is allowed on this device after login. Local
                    data is not encrypted at rest; use device encryption.
                    Logging out clears this device’s cached records.
                  </p>
                </section>
                <section className="panel">
                  <h2>Backup & restore</h2>
                  <p className="subtle">
                    Export all locally available records. Imports create copies
                    and preserve existing data.
                  </p>
                  <div className="actions">
                    <button
                      onClick={() =>
                        download(
                          "personal-os-backup.json",
                          store.backup(),
                          "application/json",
                        )
                      }
                    >
                      <ArrowDownToLine size={16} />
                      Export data
                    </button>
                    <label className="file-button">
                      Import backup
                      <input
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                          try {
                            if (e.target.files?.[0]) {
                              await store.restore(
                                await e.target.files[0].text(),
                              );
                              alert("Backup imported as copies");
                            }
                          } catch (e) {
                            alert((e as Error).message);
                          }
                        }}
                      />
                    </label>
                  </div>
                  <button
                    className="danger"
                    onClick={() => {
                      if (confirm("Delete all test and activity history?")) {
                        [
                          ...store.list("record"),
                          ...store
                            .list("recent")
                            .filter((r) =>
                              tools.some((t) => t.id === r.data.tool),
                            ),
                        ].forEach((r) => void store.remove(r.id));
                      }
                    }}
                  >
                    Clear history
                  </button>
                </section>
                <section className="panel">
                  <h2>Favorites</h2>
                  {tools.map((t) => (
                    <label className="check" key={t.id}>
                      <input
                        type="checkbox"
                        checked={prefs.favorites
                          .filter((id: string) =>
                            tools.some((t) => t.id === id),
                          )
                          .includes(t.id)}
                        onChange={() => favorite(t.id)}
                      />
                      {t.name}
                    </label>
                  ))}
                </section>
              </div>
            </>
          )}
          <footer>
            <span>
              <Check size={13} /> A little less noise. A little more you.
            </span>
            <button title={store.lastSync} onClick={() => void store.sync()}>
              <Cloud size={14} />
              {store.syncState}
            </button>
          </footer>
        </div>
      </main>
      {palette && (
        <div className="modal-backdrop" onClick={() => setPalette(false)}>
          <div
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Search tools"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hero-search">
              <Search size={20} />
              <input
                autoFocus
                placeholder="Search your tools…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button onClick={() => setPalette(false)}>
                <X size={18} />
              </button>
            </div>
            <span className="eyebrow">JUMP TO A TOOL</span>
            {tools
              .filter((t) => t.name.toLowerCase().includes(query.toLowerCase()))
              .map((t) => (
                <button
                  className="command-row"
                  key={t.id}
                  onClick={() => go(t.id)}
                >
                  <t.icon size={18} />
                  <span>{t.name}</span>
                  <ArrowUpRight size={16} />
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
