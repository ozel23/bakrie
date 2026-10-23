<?php

namespace Tests\Feature;

use App\Models\Location;
use App\Models\Membership;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\CreatesWorkspace;
use Tests\TestCase;

class MasterDataTest extends TestCase
{
    use CreatesWorkspace, RefreshDatabase;

    public function test_person_create_update_deactivation_and_stale_version_are_persisted(): void
    {
        $world = $this->world();
        Membership::factory()->create(['user_id' => $world['reviewer']->id, 'plant_id' => $world['plant']->id, 'role' => 'admin']);
        $input = ['plant_uuid' => $world['plant']->uuid, 'context_page' => 'people', 'code' => '000123', 'name' => 'Personel pengujian', 'type' => 'driver', 'version' => 0, 'active' => true];
        $response = $this->actingAs($world['reviewer'])->postJson('/workspace/actions/person.save', $input)->assertOk()->assertJsonPath('mutation.version', 1);
        $uuid = $response->json('mutation.uuid');
        $this->postJson('/workspace/actions/person.save', [...$input, 'uuid' => $uuid, 'version' => 1, 'active' => false, 'name' => 'Personel diperbarui'])->assertOk()->assertJsonPath('mutation.version', 2);
        $this->assertDatabaseHas('people', ['uuid' => $uuid, 'code' => '000123', 'active' => false, 'version' => 2, 'name' => 'Personel diperbarui']);
        $this->postJson('/workspace/actions/person.save', [...$input, 'uuid' => $uuid, 'version' => 1])->assertConflict();
        $this->actingAs($world['creator'])->postJson('/workspace/actions/person.save', $input)->assertForbidden();
    }

    public function test_location_parent_must_be_in_same_plant_and_cannot_create_a_cycle(): void
    {
        $world = $this->world();
        Membership::factory()->create(['user_id' => $world['reviewer']->id, 'plant_id' => $world['plant']->id, 'role' => 'admin']);
        $parent = Location::factory()->create(['plant_id' => $world['plant']->id]);
        $input = ['plant_uuid' => $world['plant']->uuid, 'context_page' => 'locations', 'code' => '000045', 'name' => 'Blok pengujian', 'type' => 'block', 'version' => 0, 'parent_uuid' => $parent->uuid, 'sap_code' => '0007'];
        $uuid = $this->actingAs($world['reviewer'])->postJson('/workspace/actions/location.save', $input)->assertOk()->json('mutation.uuid');
        $child = Location::query()->where('uuid', $uuid)->firstOrFail();
        $this->assertSame($parent->id, $child->parent_id);
        $this->postJson('/workspace/actions/location.save', [...$input, 'uuid' => $parent->uuid, 'code' => $parent->code, 'version' => 1, 'parent_uuid' => $child->uuid])->assertUnprocessable();
        $foreign = Location::factory()->create();
        $this->postJson('/workspace/actions/location.save', [...$input, 'uuid' => $child->uuid, 'version' => 1, 'parent_uuid' => $foreign->uuid])->assertNotFound();
        $this->assertDatabaseHas('locations', ['uuid' => $uuid, 'parent_id' => $parent->id, 'sap_code' => '0007', 'version' => 1]);
    }
}
