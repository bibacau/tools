export const units: Record<string, Record<string, number>> = {
  Length: {
    m: 1,
    km: 1000,
    cm: 0.01,
    mm: 0.001,
    μm: 1e-6,
    in: 0.0254,
    ft: 0.3048,
    yd: 0.9144,
    mi: 1609.344,
    "nautical mile": 1852,
  },
  Mass: {
    kg: 1,
    g: 0.001,
    mg: 1e-6,
    t: 1000,
    lb: 0.45359237,
    oz: 0.028349523125,
    stone: 6.35029318,
  },
  Temperature: { "°C": 1, "°F": 1, K: 1 },
  Area: {
    "m²": 1,
    "km²": 1e6,
    "cm²": 0.0001,
    "ft²": 0.09290304,
    acre: 4046.8564224,
    hectare: 10000,
  },
  Volume: {
    L: 1,
    mL: 0.001,
    "m³": 1000,
    "US gal": 3.785411784,
    "UK gal": 4.54609,
    "US cup": 0.2365882365,
    "US fl oz": 0.0295735295625,
  },
  Speed: { "m/s": 1, "km/h": 1 / 3.6, mph: 0.44704, knot: 0.5144444444 },
  Time: { s: 1, ms: 0.001, min: 60, h: 3600, day: 86400, week: 604800 },
  Pressure: { Pa: 1, kPa: 1000, bar: 100000, atm: 101325, psi: 6894.757293 },
  Energy: {
    J: 1,
    kJ: 1000,
    cal: 4.184,
    kcal: 4184,
    kWh: 3600000,
    BTU: 1055.05585,
  },
  Power: { W: 1, kW: 1000, MW: 1e6, hp: 745.699872 },
  Frequency: { Hz: 1, kHz: 1000, MHz: 1e6, GHz: 1e9 },
  "Data storage": {
    B: 1,
    kB: 1000,
    MB: 1e6,
    GB: 1e9,
    TB: 1e12,
    KiB: 1024,
    MiB: 1048576,
    GiB: 1073741824,
    bit: 0.125,
  },
  Angles: { rad: 1, deg: Math.PI / 180, turn: Math.PI * 2 },
  Force: { N: 1, kN: 1000, lbf: 4.4482216153, dyn: 0.00001 },
  Density: { "kg/m³": 1, "g/cm³": 1000, "kg/L": 1000, "lb/ft³": 16.01846337 },
  Acceleration: { "m/s²": 1, "ft/s²": 0.3048, g: 9.80665 },
  Torque: { "N·m": 1, "lb·ft": 1.3558179483, "kgf·m": 9.80665 },
};
export function convert(n: number, category: string, from: string, to: string) {
  if (category === "Temperature") {
    const c =
      from === "°F" ? ((n - 32) * 5) / 9 : from === "K" ? n - 273.15 : n;
    return to === "°F" ? (c * 9) / 5 + 32 : to === "K" ? c + 273.15 : c;
  }
  return (n * units[category][from]) / units[category][to];
}
export function volumeMass(
  n: number,
  volume: string,
  mass: string,
  density: number,
) {
  return (((n * units.Volume[volume]) / 1000) * density) / units.Mass[mass];
}
export const densities: Record<string, number> = {
  Water: 998.2,
  Milk: 1030,
  "Cooking oil": 920,
  Honey: 1420,
  Ethanol: 789,
  Gasoline: 740,
};
