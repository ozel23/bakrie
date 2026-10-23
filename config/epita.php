<?php

return [
    'offline_days' => (int) env('EPITA_OFFLINE_DAYS', 7),
    'roles' => ['operator' => 'Operator / Sopir', 'supervisor' => 'Supervisor', 'assistant' => 'Asisten Estate', 'clerk' => 'Kerani', 'maintenance' => 'Maintenance', 'manager' => 'Manager', 'admin' => 'Admin'],
    'permissions' => [
        'operator' => ['read', 'report-own', 'breakdown'],
        'supervisor' => ['read', 'plan', 'approve', 'fuel-verify', 'breakdown', 'export'],
        'assistant' => ['read', 'plan', 'approve', 'fuel-verify', 'export'],
        'clerk' => ['read', 'report-delegate', 'import', 'export'],
        'maintenance' => ['read', 'breakdown', 'maintain', 'release', 'export'],
        'manager' => ['read', 'export'],
        'admin' => ['read', 'master', 'users', 'import', 'export'],
    ],
    'units' => ['M', 'M2', 'M3', 'KG', 'TON', 'PKK', 'L', 'ORANG', 'PALLET'],
];
