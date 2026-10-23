<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $identity = function (Blueprint $t): void {
            $t->id();
            $t->uuid('uuid')->unique();
            $t->unsignedInteger('version')->default(1);
            $t->timestamps();
        };
        Schema::table('users', fn (Blueprint $t) => $t->boolean('active')->default(true));
        Schema::create('companies', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->string('code', 32)->unique();
            $t->string('name');
            $t->boolean('active')->default(true);
        });
        Schema::create('plants', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('company_id')->constrained();
            $t->string('code', 32);
            $t->string('name');
            $t->string('type', 24)->default('estate');
            $t->string('timezone', 64)->default('Asia/Jakarta');
            $t->boolean('active')->default(true);
            $t->unique(['company_id', 'code']);
        });
        Schema::create('memberships', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('user_id')->constrained();
            $t->foreignId('plant_id')->constrained();
            $t->string('role', 32);
            $t->boolean('active')->default(true);
            $t->unique(['user_id', 'plant_id', 'role']);
        });
        Schema::create('people', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('user_id')->nullable()->constrained();
            $t->string('code', 64);
            $t->string('name');
            $t->string('type', 32);
            $t->boolean('active')->default(true);
            $t->unique(['plant_id', 'code']);
        });
        Schema::create('locations', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('parent_id')->nullable()->constrained('locations');
            $t->string('code', 64);
            $t->string('sap_code', 64)->nullable();
            $t->string('name');
            $t->string('type', 32);
            $t->boolean('active')->default(true);
            $t->unique(['plant_id', 'code']);
        });
        Schema::create('equipment', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->string('code', 64);
            $t->string('name');
            $t->string('category', 32);
            $t->string('model')->nullable();
            $t->string('plate', 32)->nullable();
            $t->string('ownership', 16)->default('unverified');
            $t->string('meter_unit', 8);
            $t->decimal('last_meter', 18, 3)->nullable();
            $t->string('condition', 24)->default('unknown');
            $t->timestamp('condition_at')->nullable();
            $t->boolean('active')->default(true);
            $t->unique(['plant_id', 'code']);
        });
        Schema::create('work_plans', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('created_by')->constrained('users');
            $t->string('title');
            $t->date('starts_on');
            $t->date('ends_on');
            $t->string('status', 24)->default('draft');
            $t->text('notes')->nullable();
        });
        Schema::create('plan_items', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('work_plan_id')->constrained();
            $t->foreignId('location_id')->constrained();
            $t->string('work_code', 64);
            $t->string('description');
            $t->decimal('target', 18, 3);
            $t->string('unit', 16);
        });
        Schema::create('assignments', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('equipment_id')->constrained('equipment');
            $t->foreignId('operator_id')->constrained('people');
            $t->foreignId('plan_item_id')->nullable()->constrained();
            $t->foreignId('created_by')->constrained('users');
            $t->timestamp('starts_at');
            $t->timestamp('ends_at');
            $t->string('status', 24)->default('assigned');
            $t->text('reason')->nullable();
            $t->index(['plant_id', 'starts_at']);
        });
        Schema::create('daily_reports', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('equipment_id')->constrained('equipment');
            $t->foreignId('operator_id')->constrained('people');
            $t->foreignId('created_by')->constrained('users');
            $t->date('work_date');
            $t->string('shift', 24)->default('utama');
            $t->string('status', 24)->default('draft');
            $t->string('source', 24)->default('web');
            $t->string('condition', 24)->default('working');
            $t->string('meter_unit', 8);
            $t->decimal('meter_start', 18, 3)->nullable();
            $t->decimal('meter_end', 18, 3)->nullable();
            $t->decimal('meter_delta', 18, 3)->nullable();
            $t->unsignedInteger('work_seconds')->nullable();
            $t->text('notes')->nullable();
            $t->text('exception_reason')->nullable();
            $t->timestamp('confirmed_at')->nullable();
            $t->timestamp('approved_at')->nullable();
            $t->unique(['equipment_id', 'work_date', 'shift']);
            $t->index(['plant_id', 'work_date', 'status']);
        });
        Schema::create('report_activities', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('daily_report_id')->constrained();
            $t->foreignId('location_id')->nullable()->constrained();
            $t->foreignId('plan_item_id')->nullable()->constrained();
            $t->unsignedInteger('sequence');
            $t->timestamp('starts_at');
            $t->timestamp('ends_at');
            $t->unsignedInteger('break_seconds')->default(0);
            $t->unsignedInteger('work_seconds');
            $t->string('work_code', 64)->nullable();
            $t->text('description');
            $t->string('origin')->nullable();
            $t->string('destination')->nullable();
            $t->string('cargo')->nullable();
            $t->decimal('quantity', 18, 3)->nullable();
            $t->string('unit', 16)->nullable();
            $t->decimal('meter_start', 18, 3)->nullable();
            $t->decimal('meter_end', 18, 3)->nullable();
            $t->string('sap_order', 64)->nullable();
            $t->string('sap_operation', 64)->nullable();
        });
        Schema::create('report_people', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('daily_report_id')->constrained();
            $t->foreignId('person_id')->constrained('people');
            $t->string('role', 24);
            $t->unsignedInteger('overtime_minutes')->default(0);
            $t->unique(['daily_report_id', 'person_id']);
        });
        Schema::create('fuel_events', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('daily_report_id')->constrained();
            $t->string('meaning', 24)->default('unverified');
            $t->string('fuel_type', 32)->default('Solar');
            $t->decimal('quantity', 18, 3);
            $t->string('unit', 16)->default('L');
            $t->string('method', 32)->default('direct');
            $t->string('place')->nullable();
            $t->decimal('meter', 18, 3)->nullable();
            $t->foreignId('verified_by')->nullable()->constrained('users');
            $t->timestamp('verified_at')->nullable();
            $t->text('verification_reason')->nullable();
            $t->string('mm_status', 24)->default('not_prepared');
            $t->string('mm_reference')->nullable();
        });
        Schema::create('stock_measurements', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('daily_report_id')->constrained();
            $t->decimal('opening', 18, 3)->nullable();
            $t->decimal('closing', 18, 3)->nullable();
            $t->string('method', 32);
            $t->timestamp('measured_at');
        });
        Schema::create('approval_events', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('daily_report_id')->constrained();
            $t->foreignId('actor_id')->constrained('users');
            $t->unsignedInteger('report_version');
            $t->string('from_status', 24);
            $t->string('to_status', 24);
            $t->text('reason')->nullable();
            $t->text('membership_snapshot');
            $t->longText('snapshot');
            $t->string('snapshot_hash', 64);
            $t->timestamp('created_at');
        });
        Schema::create('breakdowns', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('equipment_id')->constrained('equipment');
            $t->foreignId('reported_by')->constrained('users');
            $t->timestamp('occurred_at');
            $t->text('description');
            $t->string('severity', 24);
            $t->string('status', 24)->default('open');
        });
        Schema::create('maintenance_orders', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('equipment_id')->constrained('equipment');
            $t->foreignId('breakdown_id')->nullable()->constrained();
            $t->foreignId('created_by')->constrained('users');
            $t->foreignId('released_by')->nullable()->constrained('users');
            $t->string('type', 24);
            $t->text('diagnosis');
            $t->string('status', 24)->default('open');
            $t->timestamp('starts_at');
            $t->timestamp('released_at')->nullable();
            $t->text('release_checklist')->nullable();
        });
        Schema::create('maintenance_actions', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('maintenance_order_id')->constrained();
            $t->foreignId('technician_id')->constrained('people');
            $t->timestamp('starts_at');
            $t->timestamp('ends_at');
            $t->text('description');
            $t->text('result');
        });
        Schema::create('maintenance_parts', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('maintenance_action_id')->constrained();
            $t->string('code', 64);
            $t->string('name');
            $t->decimal('quantity', 18, 3);
            $t->string('unit', 16);
            $t->string('warehouse_reference')->nullable();
        });
        Schema::create('downtime_intervals', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('equipment_id')->constrained('equipment');
            $t->foreignId('breakdown_id')->nullable()->constrained();
            $t->foreignId('maintenance_order_id')->nullable()->constrained();
            $t->timestamp('starts_at');
            $t->timestamp('ends_at')->nullable();
        });
        Schema::create('attachments', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('daily_report_id')->constrained();
            $t->foreignId('uploaded_by')->constrained('users');
            $t->string('path');
            $t->string('original_name');
            $t->string('mime', 64);
            $t->unsignedBigInteger('size');
            $t->string('checksum', 64);
        });
        Schema::create('import_batches', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('created_by')->constrained('users');
            $t->string('kind', 24);
            $t->string('filename');
            $t->string('path');
            $t->string('checksum', 64);
            $t->string('sap_system', 32)->nullable();
            $t->string('status', 24)->default('queued');
            $t->text('error')->nullable();
            $t->unique(['plant_id', 'kind', 'checksum']);
        });
        Schema::create('import_rows', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('import_batch_id')->constrained();
            $t->string('sheet');
            $t->unsignedInteger('row_number');
            $t->string('classification', 32);
            $t->longText('raw_payload');
            $t->longText('normalized')->nullable();
            $t->text('issues')->nullable();
            $t->string('parser_version', 16)->default('1.0');
        });
        Schema::create('sap_confirmations', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('import_row_id')->constrained();
            $t->string('sap_system', 32);
            $t->string('confirmation', 64);
            $t->string('counter', 32);
            $t->string('equipment_code', 64);
            $t->date('posting_date')->nullable();
            $t->decimal('actual_work', 18, 3)->nullable();
            $t->string('work_unit', 16)->nullable();
            $t->decimal('quantity', 18, 3)->nullable();
            $t->string('quantity_unit', 16)->nullable();
            $t->string('cancellation_raw')->nullable();
            $t->string('cancellation_status', 32)->default('unresolved');
            $t->string('payload_hash', 64);
            $t->longText('payload');
            $t->unique(['plant_id', 'sap_system', 'confirmation', 'counter', 'version'], 'sap_identity_version');
        });
        Schema::create('sync_receipts', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('user_id')->constrained();
            $t->string('device_id', 64);
            $t->uuid('operation_id');
            $t->string('payload_hash', 64);
            $t->longText('result');
            $t->timestamp('created_at');
            $t->unique(['user_id', 'device_id', 'operation_id'], 'sync_operation_identity');
        });
        Schema::create('server_changes', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('owner_id')->nullable()->constrained('users');
            $t->string('entity_type', 32);
            $t->uuid('entity_uuid');
            $t->boolean('deleted')->default(false);
            $t->longText('payload');
            $t->timestamp('created_at');
            $t->index(['plant_id', 'id']);
        });
        Schema::create('reporting_periods', function (Blueprint $t) use ($identity): void {
            $identity($t);
            $t->foreignId('plant_id')->constrained();
            $t->date('starts_on');
            $t->date('ends_on');
            $t->timestamp('closed_at')->nullable();
        });
        Schema::create('audit_events', function (Blueprint $t): void {
            $t->id();
            $t->foreignId('plant_id')->constrained();
            $t->foreignId('actor_id')->constrained('users');
            $t->string('action', 64);
            $t->string('entity_type', 64);
            $t->string('entity_uuid', 64);
            $t->longText('details');
            $t->timestamp('created_at');
        });
    }

    public function down(): void
    {
        foreach (['audit_events', 'reporting_periods', 'server_changes', 'sync_receipts', 'sap_confirmations', 'import_rows', 'import_batches', 'attachments', 'downtime_intervals', 'maintenance_parts', 'maintenance_actions', 'maintenance_orders', 'breakdowns', 'approval_events', 'stock_measurements', 'fuel_events', 'report_people', 'report_activities', 'daily_reports', 'assignments', 'plan_items', 'work_plans', 'equipment', 'locations', 'people', 'memberships', 'plants', 'companies'] as $table) {
            Schema::dropIfExists($table);
        }
        Schema::table('users', fn (Blueprint $t) => $t->dropColumn('active'));
    }
};
