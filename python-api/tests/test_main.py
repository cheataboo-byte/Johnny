import sys
import unittest
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from main import CO2Request, calculate_co2


class CO2ModelTests(unittest.TestCase):
    def test_equal_amounts_use_the_one_to_one_ratio(self):
        result = calculate_co2(CO2Request(
            bicarbonate_moles=0.001,
            acetic_acid_moles=0.001,
            temperature_c=25,
            pressure_atm=1,
        ))
        self.assertAlmostEqual(result.co2_moles, 0.001)
        self.assertAlmostEqual(result.gas_volume_l, 0.024465, places=5)
        self.assertEqual(result.limiting_reagent, "Equal virtual amounts")

    def test_bicarbonate_is_reported_as_limiting(self):
        result = calculate_co2(CO2Request(
            bicarbonate_moles=0.001,
            acetic_acid_moles=0.002,
            temperature_c=25,
            pressure_atm=1,
        ))
        self.assertEqual(result.limiting_reagent, "Sodium bicarbonate")
        self.assertAlmostEqual(result.co2_moles, 0.001)

    def test_acetic_acid_is_reported_as_limiting(self):
        result = calculate_co2(CO2Request(
            bicarbonate_moles=0.002,
            acetic_acid_moles=0.001,
            temperature_c=25,
            pressure_atm=1,
        ))
        self.assertEqual(result.limiting_reagent, "Acetic acid")
        self.assertAlmostEqual(result.co2_moles, 0.001)

    def test_pressure_changes_volume_inversely(self):
        base = CO2Request(
            bicarbonate_moles=0.001,
            acetic_acid_moles=0.001,
            temperature_c=25,
            pressure_atm=1,
        )
        low_pressure = calculate_co2(base)
        high_pressure = calculate_co2(CO2Request(
            bicarbonate_moles=0.001,
            acetic_acid_moles=0.001,
            temperature_c=25,
            pressure_atm=1.25,
        ))
        self.assertAlmostEqual(low_pressure.gas_volume_l / high_pressure.gas_volume_l, 1.25)

    def test_no_reactants_produce_no_gas(self):
        result = calculate_co2(CO2Request(
            bicarbonate_moles=0,
            acetic_acid_moles=0,
            temperature_c=25,
            pressure_atm=1,
        ))
        self.assertEqual(result.co2_moles, 0)
        self.assertEqual(result.gas_volume_l, 0)
        self.assertEqual(result.limiting_reagent, "None — no reactants selected")

    def test_out_of_range_inputs_are_rejected(self):
        with self.assertRaises(ValidationError):
            CO2Request(
                bicarbonate_moles=0.1001,
                acetic_acid_moles=0.001,
                temperature_c=25,
                pressure_atm=1,
            )


if __name__ == "__main__":
    unittest.main()
