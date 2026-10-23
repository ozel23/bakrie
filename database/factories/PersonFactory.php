<?php

namespace Database\Factories;

use App\Models\Person;
use App\Models\Plant;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Person> */
class PersonFactory extends Factory
{
    protected $model = Person::class;

    public function definition(): array
    {
        return ['plant_id' => Plant::factory(), 'code' => fake()->unique()->bothify('PER-####'), 'name' => fake()->name(), 'type' => 'operator', 'active' => true];
    }
}
