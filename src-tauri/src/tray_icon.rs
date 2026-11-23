//! Ícono de bandeja dibujado en runtime (port 1:1 de src/ui/trayIconDraw.ts).
//! Grilla de 16×16 escalada ×2 → 32×32 RGBA.

pub const SIZE: u32 = 32;
const U: i32 = 2; // píxeles por unidad de grilla

#[derive(Clone, Copy, PartialEq)]
pub enum Style {
    Bg,
    NoBg,
}

#[derive(Clone, Copy)]
pub struct State {
    /// 0–100, o None si no hay dispositivo
    pub level: Option<u8>,
    pub charging: bool,
    pub cable: bool,
    pub style: Style,
    pub frame: u8,
}

type Rgba = [u8; 4];

const OK: Rgba = [0x34, 0xd3, 0x99, 255];
const MID: Rgba = [0xfb, 0xbf, 0x24, 255];
const LOW: Rgba = [0xf8, 0x71, 0x71, 255];
const CHARGE: Rgba = [0x4c, 0xc2, 0xff, 255];
const OFF: Rgba = [0x8b, 0x90, 0xa0, 255];
const BG: Rgba = [0x15, 0x17, 0x1f, 255];
const BG_EDGE: Rgba = [0x3d, 0x3f, 0x46, 255];
const TRACK_BG: Rgba = [0x3d, 0x3f, 0x46, 255];
const TRACK_NOBG: Rgba = [128, 128, 128, 115];
const WHITE: Rgba = [255, 255, 255, 255];

const FONT: [(char, [&str; 5]); 11] = [
    ('0', ["111", "101", "101", "101", "111"]),
    ('1', ["010", "110", "010", "010", "111"]),
    ('2', ["111", "001", "111", "100", "111"]),
    ('3', ["111", "001", "011", "001", "111"]),
    ('4', ["101", "101", "111", "001", "001"]),
    ('5', ["111", "100", "111", "001", "111"]),
    ('6', ["111", "100", "111", "101", "111"]),
    ('7', ["111", "001", "010", "010", "010"]),
    ('8', ["111", "101", "111", "101", "111"]),
    ('9', ["111", "101", "111", "001", "111"]),
    ('-', ["000", "000", "111", "000", "000"]),
];

struct Canvas(Vec<u8>);

impl Canvas {
    fn px(&mut self, x: i32, y: i32, w: i32, h: i32, c: Rgba) {
        for yy in (y * U)..((y + h) * U) {
            for xx in (x * U)..((x + w) * U) {
                if (0..SIZE as i32).contains(&xx) && (0..SIZE as i32).contains(&yy) {
                    let i = ((yy as u32 * SIZE + xx as u32) * 4) as usize;
                    self.0[i..i + 4].copy_from_slice(&c);
                }
            }
        }
    }
}

pub fn level_color(level: Option<u8>, charging: bool) -> Rgba {
    match level {
        None => OFF,
        Some(_) if charging => CHARGE,
        Some(l) if l <= 20 => LOW,
        Some(l) if l <= 50 => MID,
        Some(_) => OK,
    }
}

pub fn render(st: State) -> Vec<u8> {
    let mut c = Canvas(vec![0; (SIZE * SIZE * 4) as usize]);
    let has_bg = st.style == Style::Bg;

    if has_bg {
        // cuadrado redondeado (radio 7 px) con borde suave
        let s = SIZE as f32;
        let r = 7.0f32;
        for y in 0..SIZE {
            for x in 0..SIZE {
                let (fx, fy) = (x as f32 + 0.5, y as f32 + 0.5);
                let cx = fx.clamp(1.0 + r, s - 1.0 - r);
                let cy = fy.clamp(1.0 + r, s - 1.0 - r);
                let d = ((fx - cx).powi(2) + (fy - cy).powi(2)).sqrt();
                if d <= r {
                    let i = ((y * SIZE + x) * 4) as usize;
                    let col = if d > r - 1.2 || fx < 2.0 || fy < 2.0 || fx > s - 2.0 || fy > s - 2.0 { BG_EDGE } else { BG };
                    c.0[i..i + 4].copy_from_slice(&col);
                }
            }
        }
    }

    let ink = WHITE;
    let color = level_color(st.level, st.charging);

    if st.cable {
        draw_plug(&mut c, ink);
    } else {
        match st.level {
            None => draw_text(&mut c, "--", OFF),
            Some(l) if l >= 100 => draw_full(&mut c, ink, OK),
            Some(l) => {
                let digits = if !st.charging && l <= 20 { LOW } else { ink };
                draw_text(&mut c, &format!("{:02}", l), digits)
            }
        }
    }

    // barra inferior
    let track = if has_bg { TRACK_BG } else { TRACK_NOBG };
    if st.cable {
        c.px(2, 13, 12, 2, CHARGE);
    } else {
        c.px(2, 13, 12, 2, track);
        let lvl = st.level.unwrap_or(0) as i32;
        if st.charging {
            let w = ((12 * lvl) as f32 / 100.0).round().max(2.0) as i32;
            c.px(2, 13, w, 2, color);
            let mut x = 2 + (st.frame % 4) as i32 * 3;
            while x < 2 + w {
                c.px(x, 13, 1, 2, WHITE);
                x += 12;
            }
        } else if lvl > 0 {
            c.px(2, 13, ((12 * lvl) as f32 / 100.0).round().max(1.0) as i32, 2, color);
        }
    }
    c.0
}

fn draw_text(c: &mut Canvas, text: &str, col: Rgba) {
    for (i, ch) in text.chars().take(2).enumerate() {
        let glyph = FONT.iter().find(|(k, _)| *k == ch).map(|(_, g)| g).unwrap_or(&FONT[10].1);
        let ox = 1 + i as i32 * 8;
        for (gy, row) in glyph.iter().enumerate() {
            for (gx, bit) in row.chars().enumerate() {
                if bit == '1' {
                    c.px(ox + gx as i32 * 2, 1 + gy as i32 * 2, 2, 2, col);
                }
            }
        }
    }
}

fn draw_plug(c: &mut Canvas, col: Rgba) {
    c.px(5, 1, 2, 3, col);
    c.px(9, 1, 2, 3, col);
    c.px(3, 4, 10, 2, col);
    c.px(4, 6, 8, 2, col);
    c.px(5, 8, 6, 1, col);
    c.px(7, 9, 2, 3, col);
}

fn draw_full(c: &mut Canvas, ink: Rgba, fill: Rgba) {
    c.px(1, 3, 13, 1, ink);
    c.px(1, 10, 13, 1, ink);
    c.px(1, 3, 1, 8, ink);
    c.px(13, 3, 1, 8, ink);
    c.px(14, 5, 1, 4, ink);
    c.px(3, 5, 9, 4, fill);
}

pub fn tooltip(level: Option<u8>, charging: bool, cable: bool, name: &str) -> String {
    if cable {
        return format!("{name} — conectado por cable");
    }
    match level {
        None => "Nexo — sin mouse".into(),
        Some(l) => format!("{name} — {l}%{}", if charging { " · cargando" } else { "" }),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn render_size_and_content() {
        let px = render(State { level: Some(78), charging: false, cable: false, style: Style::Bg, frame: 0 });
        assert_eq!(px.len(), (SIZE * SIZE * 4) as usize);
        // hay píxeles opacos (fondo + dígitos)
        assert!(px.chunks(4).filter(|p| p[3] == 255).count() > 300);
    }

    #[test]
    fn colors_by_level() {
        assert_eq!(level_color(Some(78), false), OK);
        assert_eq!(level_color(Some(45), false), MID);
        assert_eq!(level_color(Some(12), false), LOW);
        assert_eq!(level_color(Some(12), true), CHARGE);
        assert_eq!(level_color(None, false), OFF);
    }

    #[test]
    fn tooltip_text() {
        assert_eq!(tooltip(Some(63), false, false, "Motospeed X6"), "Motospeed X6 — 63%");
        assert_eq!(tooltip(None, false, false, "X"), "Nexo — sin mouse");
    }
}
