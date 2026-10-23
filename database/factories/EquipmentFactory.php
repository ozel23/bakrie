<?php

namespace Database\Factories;

use App\Models\Equipment;
use App\Models\Plant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Equipment> */
class EquipmentFactory extends Factory
{
    protected $model = Equipment::class;

    public function definition(): array
    {
        return ['plant_id' => Plant::factory(), 'code' => fake()->unique()->bothify('EQ-####'), 'name' => 'Equipment sintetis pengujian', 'category' => 'heavy_equipment', 'meter_unit' => 'HM', 'ownership' => 'unverified', 'condition' => 'unknown', 'active' => true];
    }
}
