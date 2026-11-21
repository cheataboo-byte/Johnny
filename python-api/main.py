"""Small, stateless science API for the virtual bicarbonate/acetic-acid model."""

import math
import os
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, ConfigDict, Field

GAS_CONSTANT_L_ATM = 0.082057366
MODEL_VERSION = "co2-ideal-v1"
CO2_EQUATION = "NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂"


class CO2Request(BaseModel):
    model_config = ConfigDict(extra="forbid")

    bicarbonate_moles: float = Field(ge=0, le=0.1, allow_inf_nan=False)
    acetic_acid_moles: float = Field(ge=0, le=0.1, allow_inf_nan=False)
    temperature_c: float = Field(ge=5, le=95, allow_inf_nan=False)
    pressure_atm: float = Field(ge=0.5, le=1.5, allow_inf_nan=False)


class CO2Result(BaseModel):
    model_version: Literal["co2-ideal-v1"]
    equation: str
    limiting_reagent: str
    co2_moles: float
    gas_volume_l: float
    temperature_k: float
    pressure_atm: float
    calculation_steps: list[str]
    assumptions: list[str]


def calculate_co2(request: CO2Request) -> CO2Result:
    """Apply the supported 1:1 reaction and ideal-gas equation only."""
    bicarbonate = request.bicarbonate_moles
    acid = request.acetic_acid_moles
    co2_moles = min(bicarbonate, acid)
    temperature_k = request.temperature_c + 273.15

    if bicarbonate == 0 and acid == 0:
        limiting = "None — no reactants selected"
    elif math.isclose(bicarbonate, acid, rel_tol=1e-12, abs_tol=1e-15):
        limiting = "Equal virtual amounts"
    elif bicarbonate < acid:
        limiting = "Sodium bicarbonate"
    else:
        limiting = "Acetic acid"

    gas_volume_l = co2_moles * GAS_CONSTANT_L_ATM * temperature_k / request.pressure_atm
    steps = [
        f"Reaction mole ratio: 1 mol NaHCO₃ : 1 mol CH₃COOH : 1 mol CO₂.",
        f"CO₂ amount = min({bicarbonate:.8g}, {acid:.8g}) = {co2_moles:.8g} mol.",
        f"T = {temperature_k:.5f} K; V = nRT/P = {gas_volume_l:.8g} L.",
    ]
    assumptions = [
        "Hypothetical reagent amounts; not measured concentrations or a procedure.",
        "Ideal gas at the selected pressure and temperature.",
        "Ignores dissolved CO₂, gas-collection losses, solution equilibrium, and heat transfer.",
        "Does not calculate final pH or temperature change.",
    ]
    return CO2Result(
        model_version=MODEL_VERSION,
        equation=CO2_EQUATION,
        limiting_reagent=limiting,
        co2_moles=co2_moles,
        gas_volume_l=gas_volume_l,
        temperature_k=temperature_k,
        pressure_atm=request.pressure_atm,
        calculation_steps=steps,
        assumptions=assumptions,
    )


app = FastAPI(title="Molecule Science API", version="1.0.0")

origins = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "").split(",") if origin.strip()]
if origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )


@app.get("/healthz")
def health() -> dict[str, str]:
    return {"status": "ok", "model": MODEL_VERSION}


@app.post("/api/v1/lab/co2", response_model=CO2Result)
def co2_simulation(request: CO2Request) -> CO2Result:
    return calculate_co2(request)
