import { icons } from "./icons";
import { loadPreferences, savePreferences } from "./preferences";

/*
  Eddie, the ASCII mascot, living in a little scene at the bottom of the
  sidebar: a house, a palm tree and a potted plant on a strip of ground.

        /\          \\|//
       /  \        _\\|//_         @
      /____\  .-----. |           \|/
      | [] |  | * * | |            |
      |_||_|  '-----' |           (_)
      ___,______.____,____________.__

  The scene is one <pre> redrawn every tick; Eddie is his own layer on top,
  moved with CSS transforms so he glides between columns instead of snapping.
  He wanders on his own: waters the plant (it grows), rests under the palm,
  and goes home to sleep when the user is away. His eyes follow the mouse;
  while the user types he stops and looks at the editor. With the sidebar
  collapsed only his head is shown.
*/

type Face = "idle" | "blink" | "happy" | "surprised" | "rest";
type Activity = "idle" | "walk" | "water" | "rest" | "home";
type Cls = "p" | "a"; // prop, accent

/** Per-theme eyes. Glyphs must be single-width in monospace fonts. */
const PERSONAS: Record<string, { eye: string; happyEye: string }> = {
  retro: { eye: "*", happyEye: "^" },
  notebook: { eye: "•", happyEye: "^" },
  github: { eye: "o", happyEye: "^" },
  "vscode-light": { eye: "●", happyEye: "^" },
  "vscode-dark": { eye: "●", happyEye: "^" },
  "solarized-light": { eye: "☼", happyEye: "☼" },
  "solarized-dark": { eye: "☼", happyEye: "☼" },
  macos: { eye: "◉", happyEye: "^" },
  pink: { eye: "♥", happyEye: "♥" },
  pixel: { eye: "■", happyEye: "▀" },
  nandao: { eye: "✱", happyEye: "^" },
  dracula: { eye: "°", happyEye: "^" },
  nord: { eye: "·", happyEye: "^" },
  cyberpunk: { eye: "◈", happyEye: "◈" },
};

// Sprites are bottom-aligned; spaces are transparent.
const HOUSE = [
  String.raw`  /\  `,
  String.raw` /  \ `,
  "/____\\",
  String.raw`| [] |`,
  String.raw`|_||_|`,
];
const PALM = [
  String.raw` \\|// `,
  String.raw`_\\|//_`,
  String.raw`   |   `,
  String.raw`   |   `,
  String.raw`   |   `,
];
const PLANT = [
  ["     ", "     ", "  ,  ", " (_) "],
  ["     ", "     ", String.raw` \|/ `, " (_) "],
  ["     ", String.raw` \|/ `, "  |  ", " (_) "],
  ["  @  ", String.raw` \|/ `, "  |  ", " (_) "],
];
const MASCOT_W = 7;
const SCENE_H = 7; // 5 rows of props, 1 row of headroom, 1 of ground
const GROUND = SCENE_H - 1;

const TICK_MS = 250;
const IDLE_SLEEP_MS = 45_000;
const TYPING_MS = 1_200;

const LINES_CLICK = ["hi, I'm Eddie!", "**bold** of you", "*poke*", "I like your notes", "markdown > word"];
const LINES_TYPING = ["nice", "keep going", "ooh, a heading?", "typo-free, I hope", "writing mode"];

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

/** The eye row inside Eddie's head, shifted by gaze. The rounded box
    around it is a CSS border: box-drawing glyphs come from fallback fonts
    with their own metrics and never line up. */
function eyeRow(face: Face, gaze: -1 | 0 | 1, theme = "retro"): string {
  const p = PERSONAS[theme] ?? PERSONAS.retro;
  const eye = { idle: p.eye, blink: "-", rest: "-", happy: p.happyEye, surprised: "O" }[face];
  const eyes = `${eye} ${eye}`;
  return gaze < 0 ? `${eyes}  ` : gaze > 0 ? `  ${eyes}` : ` ${eyes} `;
}

export interface MascotHandle {
  toggle: () => void;
  isVisible: () => boolean;
  /** Something happened in the app worth reacting to. */
  react: (event: "saved") => void;
}

export function initMascot(host: HTMLElement): MascotHandle {
  const box = document.createElement("div");
  box.className = "mascot";
  box.setAttribute("aria-hidden", "true");
  box.innerHTML = `
    <div class="mascot-stage">
      <pre class="mascot-scene"></pre>
      <div class="eddie">
        <div class="eddie-body">
          <div class="eddie-head"><pre class="eddie-eyes"></pre></div>
        </div>
        <div class="mascot-say" hidden></div>
      </div>
    </div>
    <button type="button" class="icon-btn mascot-close" title="Hide Eddie (View → Mascot)">${icons.close}</button>`;
  host.appendChild(box);

  const stage = box.querySelector(".mascot-stage") as HTMLElement;
  const scene = box.querySelector(".mascot-scene") as HTMLElement;
  const eddie = box.querySelector(".eddie") as HTMLElement;
  const body = box.querySelector(".eddie-body") as HTMLElement;
  const headEl = box.querySelector(".eddie-head") as HTMLElement;
  const eyesEl = box.querySelector(".eddie-eyes") as HTMLElement;
  const sayEl = box.querySelector(".mascot-say") as HTMLElement;

  // Scene state
  let cols = 30;
  let charW = 7.2;
  let lineH = 14;
  let x = 9; // mascot's left column
  let activity: Activity = "idle";
  let target: { x: number; then: Activity } | null = null;
  let activityTicks = 0; // how long the current activity has run
  let nextWander = Date.now() + 5000;
  let plantStage = 0;
  let drops = 0;

  // Face state
  let face: Face = "idle";
  let faceUntil = 0;
  let gaze: -1 | 0 | 1 = 0;
  let pointerX: number | null = null;
  let lastActivity = Date.now();
  let lastTyping = 0;
  let keystrokes = 0;
  let nextBlink = Date.now() + 3000;
  let sayTimer: ReturnType<typeof setTimeout> | undefined;

  const collapsed = (): boolean => document.documentElement.dataset.sidebarCollapsed === "true";
  const theme = (): string => document.documentElement.dataset.theme ?? "retro";

  const houseX = 1;
  const palmX = (): number => Math.max(houseX + HOUSE[0].length + MASCOT_W, Math.floor(cols * 0.5) - 3);
  const plantX = (): number => cols - 6;
  const doorX = (): number => houseX + HOUSE[0].length; // right beside the house

  const say = (text: string, ms = 1800): void => {
    sayEl.textContent = text;
    sayEl.hidden = false;
    // Restart the pop-in animation for back-to-back lines.
    sayEl.classList.remove("pop");
    void sayEl.offsetWidth;
    sayEl.classList.add("pop");
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => (sayEl.hidden = true), ms);
    placeBubble();
  };

  const setFace = (next: Face, ms: number): void => {
    face = next;
    faceUntil = Date.now() + ms;
  };

  /** One-shot CSS animation on an element (restarts if already running). */
  const play = (el: HTMLElement, cls: string): void => {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  };
  const hop = (): void => play(body, "hop");

  /** Little glyphs that float up from a point in the stage and fade out. */
  const burst = (glyphs: string[], col: number, row: number, cls = "spark"): void => {
    for (const g of glyphs) {
      const el = document.createElement("span");
      el.className = `mascot-fx ${cls}`;
      el.textContent = g;
      el.style.left = `${col * charW}px`;
      el.style.top = `${row * lineH}px`;
      el.style.setProperty("--dx", `${(Math.random() * 2 - 1) * charW * 3}px`);
      el.style.animationDelay = `${Math.random() * 120}ms`;
      el.addEventListener("animationend", () => el.remove());
      stage.appendChild(el);
    }
  };

  const measure = (): void => {
    const probe = document.createElement("span");
    probe.textContent = "M".repeat(20);
    probe.style.cssText = "position:absolute;visibility:hidden;white-space:pre";
    scene.appendChild(probe);
    charW = probe.offsetWidth / 20 || charW; // layout px, unaffected by zoom
    lineH = parseFloat(getComputedStyle(scene).lineHeight) || lineH;
    probe.remove();
    cols = Math.max(24, Math.floor(stage.clientWidth / charW));
    x = Math.min(x, cols - MASCOT_W);
    eddie.style.bottom = `${lineH}px`; // sits on the row above the ground line
  };

  // --- Drawing -------------------------------------------------------------
  function render(): void {
    const now = Date.now();
    if (faceUntil && now > faceUntil) {
      face = activity === "rest" ? "rest" : "idle";
      faceUntil = 0;
    }
    if (face === "idle" && now > nextBlink) {
      setFace("blink", 160);
      nextBlink = now + 2500 + Math.random() * 4000;
    }

    // Gaze: at the editor while typing, else at the pointer, else ahead.
    const typing = now - lastTyping < TYPING_MS;
    if (typing) gaze = 1;
    else if (pointerX !== null && activity !== "walk") {
      const r = headEl.getBoundingClientRect();
      const headX = r.left + r.width / 2;
      gaze = Math.abs(pointerX - headX) < charW * 3 ? 0 : pointerX < headX ? -1 : 1;
    }

    eyesEl.textContent = eyeRow(face, gaze, theme());
    if (collapsed()) return;

    const walking = activity === "walk" && !typing;
    eddie.classList.toggle("walking", walking);
    eddie.classList.toggle("resting", activity === "rest");
    eddie.classList.toggle("away", activity === "home");
    eddie.style.transform = `translateX(${x * charW}px)`;

    const chars: string[][] = Array.from({ length: SCENE_H }, () => Array(cols).fill(" "));
    const cls: (Cls | "")[][] = Array.from({ length: SCENE_H }, () => Array(cols).fill(""));
    const put = (rows: string[], left: number, bottom: number, c: Cls): void => {
      rows.forEach((row, i) => {
        const y = bottom - (rows.length - 1 - i);
        if (y < 0 || y >= SCENE_H) return;
        [...row].forEach((ch, j) => {
          const cx = left + j;
          if (ch === " " || cx < 0 || cx >= cols) return;
          chars[y][cx] = ch;
          cls[y][cx] = c;
        });
      });
    };

    put(HOUSE, houseX, GROUND - 1, "p");
    // Home: a warm light in the window.
    if (activity === "home") put(["[]"], houseX + 2, GROUND - 2, "a");
    put(PALM, palmX(), GROUND - 1, "p");
    const plant = PLANT[plantStage];
    put(plant, plantX(), GROUND - 1, "p");
    if (plantStage === PLANT.length - 1) put(["@"], plantX() + 2, GROUND - plant.length, "a");
    if (drops > 0) {
      const top = GROUND - 1 - plant.filter((r) => r.trim()).length;
      put([drops === 1 ? "' '" : " ' "], plantX() + 1, top, "a");
    }
    // Ground with a few tufts so it reads as grass, not a rule.
    put([Array.from({ length: cols }, (_, i) => (i % 9 === 4 ? "," : i % 13 === 8 ? "." : "_")).join("")], 0, GROUND, "p");

    scene.innerHTML = chars
      .map((row, y) => {
        let html = "";
        let run = "";
        let runCls: Cls | "" = "";
        const flush = (): void => {
          html += runCls ? `<span class="${runCls}">${escape(run)}</span>` : escape(run);
        };
        row.forEach((ch, i) => {
          if (cls[y][i] !== runCls) {
            flush();
            run = "";
            runCls = cls[y][i];
          }
          run += ch;
        });
        flush();
        return html;
      })
      .join("\n");
    placeBubble();
  }

  /** Keep the bubble inside the stage; its tail still points at Eddie. */
  function placeBubble(): void {
    if (sayEl.hidden) return;
    const ex = collapsed() ? 0 : x * charW;
    const maxLeft = Math.max(0, stage.clientWidth - sayEl.offsetWidth);
    const left = Math.min(ex, maxLeft) - ex;
    sayEl.style.left = `${left}px`;
    sayEl.style.setProperty("--tail", `${Math.max(8, (MASCOT_W / 2) * charW - left)}px`);
  }

  // --- Behaviour -----------------------------------------------------------
  const goTo = (tx: number, then: Activity): void => {
    target = { x: Math.max(0, Math.min(cols - MASCOT_W, tx)), then };
    activity = "walk";
  };

  const arrive = (then: Activity): void => {
    activity = then;
    activityTicks = 0;
    if (then === "water") say("water time", 1500);
    if (then === "rest") setFace("rest", 60_000);
  };

  const wake = (): void => {
    lastActivity = Date.now();
    if (activity === "home") {
      activity = "idle";
      x = doorX();
      setFace("surprised", 700);
      render();
      hop();
      say("!", 700);
      nextWander = Date.now() + 4000;
    }
  };

  function tick(): void {
    if (box.hidden) return;
    if (collapsed()) {
      render();
      return;
    }
    const now = Date.now();
    const typing = now - lastTyping < TYPING_MS;
    activityTicks++;

    if (activity !== "home" && now - lastActivity > IDLE_SLEEP_MS && target?.then !== "home") {
      goTo(doorX(), "home");
    }

    if (activity === "walk" && target) {
      if (!typing) {
        if (x === target.x) {
          const then = target.then;
          target = null;
          arrive(then);
        } else {
          gaze = x < target.x ? 1 : -1;
          x += gaze;
        }
      }
    } else if (activity === "home") {
      // Asleep inside: z's drift up out of the chimney side of the roof.
      if (activityTicks % 6 === 0) burst([pick(["z", "Z"])], houseX + 4, 1, "snore");
    } else if (activity === "water") {
      drops = activityTicks % 2 ? 1 : 2;
      if (activityTicks > 12) {
        drops = 0;
        if (plantStage < PLANT.length - 1) {
          plantStage++;
          say(plantStage === PLANT.length - 1 ? "it bloomed!" : "grow, little one");
        } else {
          say("so pretty");
        }
        burst(["*", "·", "*"], plantX() + 2, 1);
        setFace("happy", 1200);
        hop();
        activity = "idle";
        nextWander = now + 6000 + Math.random() * 8000;
      }
    } else if (activity === "rest") {
      if (activityTicks === 8) say("~ breeze ~", 1500);
      if (activityTicks > 40 || typing) {
        activity = "idle";
        face = "idle";
        faceUntil = 0;
        nextWander = now + 5000 + Math.random() * 8000;
      }
    } else if (activity === "idle" && !typing && now > nextWander) {
      const options: [number, Activity][] = [
        [plantX() - MASCOT_W + 1, plantStage < PLANT.length - 1 ? "water" : "idle"],
        [palmX(), "rest"],
        [Math.floor(Math.random() * (cols - MASCOT_W)), "idle"],
      ];
      const [tx, then] = pick(options);
      goTo(tx, then);
      nextWander = now + 8000 + Math.random() * 10000;
    }
    render();
  }

  // --- Events --------------------------------------------------------------
  document.addEventListener("pointermove", (e) => {
    pointerX = e.clientX;
    wake();
  });

  document.addEventListener("keydown", (e) => {
    wake();
    const inEditor = e.target instanceof Element && e.target.closest(".ProseMirror");
    if (!inEditor || e.ctrlKey || e.metaKey || e.key.length !== 1) return;
    lastTyping = Date.now();
    if (++keystrokes % 60 === 0) say(pick(LINES_TYPING));
  });

  body.addEventListener("click", () => {
    wake();
    setFace("surprised", 800);
    render();
    hop();
    say(pick(LINES_CLICK));
  });

  const setVisible = (visible: boolean): void => {
    box.hidden = !visible;
    savePreferences({ showMascot: visible });
    if (visible) {
      measure();
      render();
    }
  };
  box.querySelector(".mascot-close")!.addEventListener("click", () => setVisible(false));

  new ResizeObserver(() => {
    measure();
    render();
  }).observe(stage);

  box.hidden = !loadPreferences().showMascot;
  measure();
  render();
  setInterval(tick, TICK_MS);

  return {
    toggle: () => setVisible(box.hidden),
    isVisible: () => !box.hidden,
    react: (event) => {
      if (event === "saved") {
        wake();
        setFace("happy", 1600);
        render();
        hop();
        if (!collapsed()) burst(["*", "*", "·", "*"], x + 3, GROUND - 4);
        say("saved!");
      }
    },
  };
}

function escape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
