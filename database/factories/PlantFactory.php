<?php

namespace Database\Factories;

use App\Models\Company;
use App\Models\Plant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Plant> */
class PlantFactory extends Factory
{
    protected $model = Plant::class;

    public function definition(): array
    {
        return ['company_id' => Company::factory(), 'code' => fake()->unique()->bothify('PL-####'), 'name' => fake()->city(), 'active' => true, 'timezone' => 'Asia/Jakarta'];
    }
}
