<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\WorkspaceData;
use Illuminate\Contracts\Auth\UserProvider;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\CreatesWorkspace;
use Tests\TestCase;

class OperationalAccessTest extends TestCase
{
    use CreatesWorkspace, RefreshDatabase;

    public function test_company_login_redirects_to_authorized_dashboard_and_logout_invalidates_session(): void
    {
        $world = $this->world();
        $this->post('/login', ['email' => $world['creator']->email, 'password' => 'password'])->assertRedirect('/dashboard');
        $this->assertAuthenticatedAs($world['creator']);
        $this->get('/dashboard')->assertRedirect('/app/dashboard');
        $this->get('/app/dashboard')->assertOk()->assertInertia(fn (Assert $page) => $page->component('Workspace')
            ->where('auth.email', $world['creator']->email)->where('plant.uuid', $world['plant']->uuid)
            ->missing('preview')->has('snapshot.metrics')->where('permissions', fn ($permissions) => $permissions->contains('report-delegate') && ! $permissions->contains('approve')));
        $this->post('/logout')->assertRedirect('/login');
        $this->assertGuest();
        $this->get('/app/dashboard')->assertRedirect('/login');
    }

    public function test_synthetic_routes_credentials_and_session_no_longer_grant_access(): void
    {
        $this->get('/login')->assertOk()->assertInertia(fn (Assert $page) => $page->component('Login')->missing('demoAccounts')->missing('demoPassword')->missing('previewAvailable'));
        foreach (['/preview/dashboard', '/preview/approvals', '/preview/export', '/preview/report-preview', '/preview/import'] as $path) {
            $this->withSession(['epita.demo_account' => 'admin@demo.epita.test'])->get($path)->assertNotFound();
            $this->postJson($path)->assertNotFound();
        }
        $this->post('/login', ['email' => 'admin@demo.epita.test', 'password' => 'EpitaDemo2026!'])->assertSessionHasErrors('email');
        $this->get('/app/dashboard')->assertRedirect('/login');
        $this->postJson('/workspace/actions/equipment.save')->assertUnauthorized();
    }

    public function test_inactive_account_cannot_login_and_account_without_plant_has_useful_error(): void
    {
        $user = User::factory()->create();
        $user->forceFill(['active' => false])->save();
        $this->post('/login', ['email' => $user->email, 'password' => 'password'])->assertSessionHasErrors('email');
        $this->assertGuest();
        $user->forceFill(['active' => true])->save();
        $this->actingAs($user)->get('/app/dashboard')->assertForbidden()->assertInertia(fn (Assert $page) => $page->component('Error')->where('status', 403)->where('message', fn ($message) => str_contains($message, 'administrator')));
    }

    public function test_database_failure_returns_honest_unavailable_state_with_request_id_and_no_dataset(): void
    {
        $world = $this->world();
        $failure = new QueryException('sqlsrv', 'SELECT private_table', ['private-value'], new \PDOException('private-server'));
        $this->mock(WorkspaceData::class, fn ($mock) => $mock->shouldReceive('screen')->andThrow($failure));
        $response = $this->actingAs($world['creator'])->get('/app/dashboard');
        $response->assertStatus(503)->assertHeader('X-Request-ID')->assertInertia(fn (Assert $page) => $page->component('Error')->where('status', 503)->has('requestId')->missing('snapshot'));
        $response->assertDontSee('private-server')->assertDontSee('private_table')->assertDontSee('private-value');
        $this->getJson('/app/dashboard')->assertStatus(503)->assertJsonStructure(['message', 'request_id'])->assertJsonMissingPath('snapshot');
    }

    public function test_login_database_failure_does_not_offer_another_workspace(): void
    {
        $failure = new QueryException('sqlsrv', 'SELECT private_table', [], new \PDOException('private-server'));
        $provider = \Mockery::mock(UserProvider::class);
        $provider->shouldReceive('retrieveByCredentials')->once()->andThrow($failure);
        Auth::guard('web')->setProvider($provider);
        $this->from('/login')->post('/login', ['email' => 'employee@example.test', 'password' => 'private-password'])->assertRedirect('/login')
            ->assertSessionHas('status', fn ($status) => str_contains($status, 'Login belum berhasil') && ! str_contains($status, 'pratinjau') && ! str_contains($status, 'private-server'));
    }

    public function test_mobile_login_requires_membership_and_preserves_device_contract(): void
    {
        $user = User::factory()->create();
        $device = (string) Str::uuid();
        $this->postJson('/api/v1/auth/login', ['email' => $user->email, 'password' => 'password', 'device_id' => $device])->assertForbidden();
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $world = $this->world();
        $this->postJson('/api/v1/auth/login', ['email' => $world['creator']->email, 'password' => 'password', 'device_id' => $device])->assertOk()->assertJsonStructure(['token', 'user', 'offline_until']);
        $this->assertDatabaseCount('personal_access_tokens', 1);
    }
}
