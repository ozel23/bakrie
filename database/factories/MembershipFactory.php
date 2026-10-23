<?php

namespace Database\Factories;

use App\Models\Membership;
use App\Models\Plant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/** @extends Factory<Membership> */
class MembershipFactory extends Factory
{
    protected $model = Membership::class;

    public function definition(): array
    {
        return ['plant_id' => Plant::factory(), 'user_id' => User::factory(), 'role' => 'operator', 'active' => true];
    }
}
