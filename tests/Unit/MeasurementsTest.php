<?php

namespace Tests\Unit;

use App\Services\Measurements;
use PHPUnit\Framework\TestCase;

class MeasurementsTest extends TestCase
{
    public function test_meter_decimal_and_time_are_exact(): void
    {
        $m = new Measurements;
        $this->assertSame('7.000', $m->meter('10023', '10030'));
        $this->assertSame(7200, $m->seconds('2026-10-01T23:00:00+07:00', '2026-10-02T01:00:00+07:00'));
        $this->assertSame(600, $m->seconds('2026-10-01T07:00:00+07:00', '2026-10-01T07:10:00+07:00'));
        $this->assertSame('0.166666666666', $m->ratio('600', '3600', 12));
        $this->assertSame('40.000', $m->stockConsumption('30', '20', '10'));
        $this->assertNull($m->stockConsumption(null, '20', '10'));
        $this->assertNull($m->ratio('1', '0'));
        $this->assertNull($m->ratio(null, '7'));
    }

    public function test_union_does_not_count_overlapping_downtime_twice(): void
    {
        $this->assertSame(80, (new Measurements)->unionSeconds([[0, 50], [20, 80], [80, 100]], 10, 90));
    }
}
