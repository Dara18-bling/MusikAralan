<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class SetupAdmin extends Command
{
    protected $signature = 'musik:setup-admin
        {--name= : The administrator name}
        {--email= : The administrator email address}';

    protected $description = 'Create the first approved administrator account.';

    public function handle(): int
    {
        if (User::query()->exists()) {
            $this->error('Setup is only available before the first user account has been created.');

            return self::FAILURE;
        }

        $name = trim((string) ($this->option('name') ?? $this->ask('Admin name')));
        $email = strtolower(trim((string) ($this->option('email') ?? $this->ask('Admin email'))));
        $password = $this->secret('Password');
        $passwordConfirmation = $this->secret('Confirm password');

        $validator = Validator::make([
            'name' => $name,
            'email' => $email,
            'password' => $password,
            'password_confirmation' => $passwordConfirmation,
        ], [
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z0-9\s])\S+$/',
            ],
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->all() as $error) {
                $this->error($error);
            }

            return self::FAILURE;
        }

        return DB::transaction(function () use ($name, $email, $password): int {
            if (User::query()->exists()) {
                $this->error('Another user account was created during setup. No administrator was created.');

                return self::FAILURE;
            }

            User::query()->create([
                'name' => $name,
                'email' => $email,
                'password' => Hash::make($password),
                'role' => 'admin',
                'status' => 'approved',
                'approved_at' => now(),
            ]);

            $this->info("Administrator account created for {$email}.");

            return self::SUCCESS;
        });
    }
}
