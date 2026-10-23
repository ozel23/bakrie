<?php

namespace App\Console\Commands;

use App\Models\Company;
use App\Models\Membership;
use App\Models\Person;
use App\Models\Plant;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class ProvisionUser extends Command
{
    protected $signature = 'epita:provision';

    protected $description = 'Buat akun dan membership dari identitas perusahaan yang sah (interaktif)';

    public function handle(): int
    {
        if (! $this->input->isInteractive()) {
            $this->error('Gunakan terminal interaktif untuk membuat akun dengan sandi privat.');

            return self::FAILURE;
        }
        $data = ['company_code' => $this->ask('Kode perusahaan'), 'company_name' => $this->ask('Nama perusahaan'), 'plant_code' => $this->ask('Kode plant'), 'plant_name' => $this->ask('Nama plant'), 'email' => $this->ask('Email pengguna'), 'name' => $this->ask('Nama pengguna'), 'role' => $this->choice('Role', array_keys(config('epita.permissions'))), 'password' => $this->secret('Kata sandi baru (minimal 12 karakter)')];
        $validator = Validator::make($data, ['company_code' => 'required|string|max:32', 'company_name' => 'required|string|max:255', 'plant_code' => 'required|string|max:32', 'plant_name' => 'required|string|max:255', 'email' => 'required|email|max:255', 'name' => 'required|string|max:255', 'role' => 'required|in:'.implode(',', array_keys(config('epita.permissions'))), 'password' => 'required|string|min:12']);
        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }
        if (User::query()->where('email', $data['email'])->exists()) {
            $this->error('Akun sudah ada. Command ini tidak mengubah password atau menambah hak akun yang ada.');

            return self::FAILURE;
        }
        DB::transaction(function () use ($data): void {
            $company = Company::firstOrCreate(['code' => $data['company_code']], ['name' => $data['company_name']]);
            $plant = Plant::firstOrCreate(['company_id' => $company->id, 'code' => $data['plant_code']], ['name' => $data['plant_name']]);
            $user = User::create(['name' => $data['name'], 'email' => $data['email'], 'password' => Hash::make($data['password'])]);
            Membership::create(['user_id' => $user->id, 'plant_id' => $plant->id, 'role' => $data['role']]);
            if ($data['role'] === 'operator') {
                Person::create(['plant_id' => $plant->id, 'user_id' => $user->id, 'code' => 'USER-'.$user->id, 'name' => $user->name, 'type' => 'operator']);
            }
        });
        $this->info('Akun dan membership berhasil dibuat. Tidak ada transaksi operasional yang di-seed.');

        return self::SUCCESS;
    }
}
