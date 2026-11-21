const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const localDevelopment = LOCAL_HOSTS.has(location.hostname);

export const SCIENCE_API_BASE_URL = localDevelopment
  ? "http://127.0.0.1:8001/api"
  : "/api";

const GAS_CONSTANT_L_ATM = 0.082057366;
const CO2_EQUATION = "NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂";

function isClose(actual, expected, tolerance = 1e-9) {
  return Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance * Math.max(1, Math.abs(expected));
}

export async function calculateCO2WithPython(input, signal) {
  const response = await fetch(`${SCIENCE_API_BASE_URL}/v1/lab/co2`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      bicarbonate_moles: input.bicarbonateMoles,
      acetic_acid_moles: input.aceticAcidMoles,
      temperature_c: input.temperature,
      pressure_atm: input.pressureAtm
    }),
    signal
  });
  if (!response.ok) {
    throw new Error(`Python science API returned HTTP ${response.status}.`);
  }

  const result = await response.json();
  const expectedMoles = Math.min(input.bicarbonateMoles, input.aceticAcidMoles);
  const expectedKelvin = input.temperature + 273.15;
  const expectedVolume = expectedMoles * GAS_CONSTANT_L_ATM * expectedKelvin / input.pressureAtm;
  const amountsAreTied = Math.abs(input.bicarbonateMoles - input.aceticAcidMoles) <=
    Math.max(1e-15, 1e-12 * Math.max(Math.abs(input.bicarbonateMoles), Math.abs(input.aceticAcidMoles)));
  const expectedLimiting = input.bicarbonateMoles === 0 && input.aceticAcidMoles === 0
    ? "None — no reactants selected"
    : amountsAreTied
      ? "Equal virtual amounts"
      : input.bicarbonateMoles < input.aceticAcidMoles
        ? "Sodium bicarbonate"
        : "Acetic acid";
  if (
    result.model_version !== "co2-ideal-v1" ||
    result.equation !== CO2_EQUATION ||
    !isClose(result.co2_moles, expectedMoles) ||
    !isClose(result.gas_volume_l, expectedVolume) ||
    !isClose(result.temperature_k, expectedKelvin) ||
    !isClose(result.pressure_atm, input.pressureAtm) ||
    result.limiting_reagent !== expectedLimiting ||
    !Array.isArray(result.calculation_steps) ||
    result.calculation_steps.length !== 3 ||
    result.calculation_steps.some(step => typeof step !== "string" || step.length > 240) ||
    !Array.isArray(result.assumptions) ||
    result.assumptions.length !== 4 ||
    result.assumptions.some(note => typeof note !== "string" || note.length > 180)
  ) {
    throw new Error("Python science API response did not match the supported CO₂ model.");
  }
  return result;
}
