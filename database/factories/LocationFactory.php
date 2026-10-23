<?php

namespace Database\Factories;

use App\Models\Location;
use App\Models\Plant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Location> */
class LocationFactory extends Factory
{
    protected $model = Location::class;

    public function definition(): array
    {
        return ['plant_id' => Plant::factory(), 'code' => fake()->unique()->bothify('LOC-####'), 'name' => 'Lokasi pengujian', 'type' => 'block', 'active' => true];
    }
}
