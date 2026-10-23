<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('work_plans', fn (Blueprint $table) => $table->index(['plant_id', 'starts_on', 'ends_on'], 'work_plans_period_scope'));
        Schema::table('maintenance_orders', fn (Blueprint $table) => $table->index(['plant_id', 'starts_at', 'released_at'], 'maintenance_orders_period_scope'));
        Schema::table('breakdowns', fn (Blueprint $table) => $table->index(['plant_id', 'occurred_at', 'status'], 'breakdowns_period_scope'));
        Schema::table('downtime_intervals', fn (Blueprint $table) => $table->index(['equipment_id', 'starts_at', 'ends_at'], 'downtime_equipment_period'));
    }

    public function down(): void
    {
        Schema::table('work_plans', fn (Blueprint $table) => $table->dropIndex('work_plans_period_scope'));
        Schema::table('maintenance_orders', fn (Blueprint $table) => $table->dropIndex('maintenance_orders_period_scope'));
        Schema::table('breakdowns', fn (Blueprint $table) => $table->dropIndex('breakdowns_period_scope'));
        Schema::table('downtime_intervals', fn (Blueprint $table) => $table->dropIndex('downtime_equipment_period'));
    }
};
