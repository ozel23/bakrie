<?php

namespace App\Services;

use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

class Measurements
{
    public function decimal(string|int|float $value): string
    {
        $value = (string) $value;
        if (! preg_match('/^\d{1,15}(\.\d{1,3})?$/', $value)) {
            throw ValidationException::withMessages(['quantity' => 'Gunakan angka positif dengan maksimal tiga desimal.']);
        }

        return bcadd($value, '0', 3);
    }

    public function meter(string $start, string $end): string
    {
        $delta = bcsub($this->decimal($end), $this->decimal($start), 3);
        if (bccomp($delta, '0', 3) < 0) {
            throw ValidationException::withMessages(['meter_end' => 'Meter akhir harus sama atau lebih besar dari meter awal.']);
        }

        return $delta;
    }

    public function seconds(string $start, string $end, int $breakSeconds = 0): int
    {
        $seconds = CarbonImmutable::parse($end)->getTimestamp() - CarbonImmutable::parse($start)->getTimestamp();
        if ($seconds <= 0 || $breakSeconds < 0 || $breakSeconds > $seconds) {
            throw ValidationException::withMessages(['activities' => 'Waktu selesai harus setelah mulai; istirahat tidak boleh melebihi durasi sesi.']);
        }

        return $seconds - $breakSeconds;
    }

    public function ratio(?string $numerator, ?string $denominator, int $precision = 6): ?string
    {
        return $numerator === null || $denominator === null || bccomp($denominator, '0', 9) <= 0 ? null : bcdiv($numerator, $denominator, $precision);
    }

    public function stockConsumption(?string $opening, ?string $received, ?string $closing): ?string
    {
        if ($opening === null || $received === null || $closing === null) {
            return null;
        }
        $value = bcsub(bcadd($this->decimal($opening), $this->decimal($received), 3), $this->decimal($closing), 3);
        if (bccomp($value, '0', 3) < 0) {
            throw ValidationException::withMessages(['stock' => 'Neraca solar negatif; periksa pengukuran dan periodenya.']);
        }

        return $value;
    }

    /** @param array<array{0:int,1:int}> $intervals */
    public function unionSeconds(array $intervals, int $cutoffStart, int $cutoffEnd): int
    {
        $clipped = [];
        foreach ($intervals as [$start,$end]) {
            $start = max($start, $cutoffStart);
            $end = min($end, $cutoffEnd);
            if ($end > $start) {
                $clipped[] = [$start, $end];
            }
        }
        usort($clipped, fn (array $a, array $b) => $a[0] <=> $b[0]);
        $total = 0;
        $lastEnd = $cutoffStart;
        foreach ($clipped as [$start,$end]) {
            $total += max(0, $end - max($start, $lastEnd));
            $lastEnd = max($lastEnd, $end);
        }

        return $total;
    }
}
