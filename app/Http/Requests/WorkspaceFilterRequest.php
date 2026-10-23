<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class WorkspaceFilterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        $rules = [
            'plant' => 'nullable|uuid', 'period' => 'nullable|date_format:Y-m',
            'q' => 'nullable|string|max:150',
            'meaning' => 'nullable|in:unverified,receipt,consumption',
            'status' => 'nullable|in:all,pending,draft,submitted,reviewed,returned,approved,open,in_progress,released,closed,assigned,completed,cancelled',
            'equipment_uuid' => 'nullable|uuid', 'operator_uuid' => 'nullable|uuid',
            'category' => 'nullable|in:all,heavy_equipment,vehicle,engine,genset',
            'condition' => 'nullable|in:all,working,standby,breakdown,maintenance,unknown',
        ];
        foreach (['reports', 'equipment', 'people', 'locations', 'assignments', 'plans', 'orders', 'breakdowns', 'imports', 'fuel'] as $resource) {
            $rules[$resource.'_page'] = 'nullable|integer|min:1';
            $rules[$resource.'_per_page'] = 'nullable|integer|in:8,15,30';
        }

        return $rules;
    }
}
