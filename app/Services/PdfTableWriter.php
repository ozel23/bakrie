<?php

namespace App\Services;

use Dompdf\Adapter\CPDF;
use Dompdf\Dompdf;
use Dompdf\FontMetrics;
use Dompdf\Options;

class PdfTableWriter
{
    private CPDF $canvas;

    private FontMetrics $metrics;

    private string $font;

    private string $bold;

    private array $document;

    private float $y;

    private float $margin = 36;

    private float $bottom;

    private float $lineHeight = 11;

    public function render(array $document): string
    {
        $this->document = $document;
        $options = new Options;
        $options->set('isRemoteEnabled', false);
        $options->set('isPhpEnabled', false);
        $options->set('isFontSubsettingEnabled', true);
        $pdf = new Dompdf($options);
        $this->canvas = new CPDF('a3', 'landscape', $pdf);
        $this->metrics = $pdf->getFontMetrics();
        $this->font = $this->metrics->getFont('DejaVu Sans');
        $this->bold = $this->metrics->getFont('DejaVu Sans', 'bold');
        $this->bottom = $this->canvas->get_height() - 50;
        $this->startPage(true);
        $this->table($document['columns'], $document['rows']);
        foreach ($document['summary'] as $summary) {
            $this->paragraph($summary, true);
        }
        foreach ($document['sections'] as $section) {
            $this->table($section['columns'], $section['rows'], $section['title']);
        }
        $this->space(82);
        $this->y += 18;
        $width = ($this->canvas->get_width() - 2 * $this->margin) / 3;
        foreach (['Dibuat oleh', 'Diperiksa oleh', 'Disetujui oleh'] as $index => $label) {
            $x = $this->margin + $index * $width + 12;
            $this->canvas->text($x, $this->y, $label, $this->bold, 9);
            $this->canvas->line($x, $this->y + 42, $x + $width - 24, $this->y + 42, [.7, .75, .8], .5);
            $this->canvas->text($x, $this->y + 45, 'Nama / jabatan / tanggal', $this->font, 8);
        }
        $this->y += 70;
        foreach ($document['notes'] as $note) {
            $this->paragraph($note);
        }
        $footer = 'EPITA · '.($document['watermark'] ?? $document['source_label'] ?? 'Data sesuai filter');
        $this->canvas->page_text($this->margin, $this->canvas->get_height() - 25, $footer, $this->font, 8, [.35, .43, .5]);
        $this->canvas->page_text($this->canvas->get_width() - 145, $this->canvas->get_height() - 25, 'Halaman {PAGE_NUM} / {PAGE_COUNT}', $this->font, 8, [.35, .43, .5]);

        return $this->canvas->output();
    }

    private function startPage(bool $first = false): void
    {
        if (! $first) {
            $this->canvas->new_page();
        }
        $width = $this->canvas->get_width() - 2 * $this->margin;
        $this->canvas->text($this->margin, 24, 'EPITA', $this->bold, 19, [.04, .2, .32]);
        $this->canvas->line($this->margin, 52, $this->margin + $width, 52, [.04, .2, .32], 1);
        $this->y = 63;
        foreach ($this->wrap($this->document['title'], $width, 12, true) as $line) {
            $this->canvas->text($this->margin, $this->y, $line, $this->bold, 12, [.04, .2, .32]);
            $this->y += 16;
        }
        foreach ($this->wrap($this->document['subtitle'], $width, 9) as $line) {
            $this->canvas->text($this->margin, $this->y, $line, $this->font, 9, [.35, .43, .5]);
            $this->y += 13;
        }
        if ($this->document['watermark']) {
            $this->canvas->text($this->margin, $this->y + 2, $this->document['watermark'], $this->bold, 9, [.55, .35, .08]);
            $this->y += 19;
        }
        $this->y += 8;
    }

    private function table(array $columns, array $rows, ?string $title = null): void
    {
        if ($columns === []) {
            return;
        }
        $width = ($this->canvas->get_width() - 2 * $this->margin) / count($columns);
        $header = array_map(fn ($column) => $this->wrap($column, $width - 8, 8.5, true), $columns);
        $headerHeight = max(array_map('count', $header)) * $this->lineHeight + 10;
        $heading = function () use ($header, $headerHeight, $width, $title): void {
            if ($this->y + $headerHeight + 40 > $this->bottom) {
                $this->startPage();
            }
            if ($title) {
                $this->paragraph($title, true);
            }
            $this->cells($header, $width, $headerHeight, true);
        };
        $this->y += 8;
        $heading();
        if ($rows === []) {
            $this->paragraph('Tidak ada data pada filter ini.');
        }
        foreach ($rows as $row) {
            $cells = [];
            foreach ($columns as $index => $column) {
                $value = $row[$index] ?? null;
                $text = $value === null || $value === '' ? '—' : (is_float($value) ? number_format($value, 3, ',', '.') : (string) $value);
                $cells[] = $this->wrap($text, $width - 8, 8.5);
            }
            $lines = max(array_map('count', $cells));
            if ($this->y + $lines * $this->lineHeight + 10 > $this->bottom) {
                $this->startPage();
                $heading();
            }
            $offset = 0;
            while ($offset < $lines) {
                $capacity = (int) floor(($this->bottom - $this->y - 10) / $this->lineHeight);
                if ($capacity < 1) {
                    $this->startPage();
                    $heading();

                    continue;
                }
                $take = min($capacity, $lines - $offset);
                $this->cells(array_map(fn ($cell) => array_slice($cell, $offset, $take), $cells), $width, $take * $this->lineHeight + 10);
                $offset += $take;
                if ($offset < $lines) {
                    $this->startPage();
                    $heading();
                }
            }
        }
        $this->y += 10;
    }

    private function cells(array $cells, float $width, float $height, bool $header = false): void
    {
        foreach ($cells as $index => $lines) {
            $x = $this->margin + $index * $width;
            if ($header) {
                $this->canvas->filled_rectangle($x, $this->y, $width, $height, [.91, .95, .98]);
            }
            $this->canvas->rectangle($x, $this->y, $width, $height, [.77, .84, .9], .5);
            foreach ($lines as $lineIndex => $line) {
                $this->canvas->text($x + 4, $this->y + 4 + $lineIndex * $this->lineHeight, $line, $header ? $this->bold : $this->font, 8.5, [.1, .2, .28]);
            }
        }
        $this->y += $height;
    }

    private function space(float $height): void
    {
        if ($this->y + $height > $this->bottom) {
            $this->startPage();
        }
    }

    private function paragraph(string $text, bool $bold = false): void
    {
        foreach ($this->wrap($text, $this->canvas->get_width() - 2 * $this->margin, 9, $bold) as $line) {
            $this->space(15);
            $this->canvas->text($this->margin, $this->y, $line, $bold ? $this->bold : $this->font, 9, [.15, .25, .33]);
            $this->y += 14;
        }
    }

    /** @return list<string> */
    private function wrap(string $text, float $width, float $size, bool $bold = false): array
    {
        $font = $bold ? $this->bold : $this->font;
        $lines = [];
        foreach (preg_split('/\R/u', $text) as $paragraph) {
            $line = '';
            foreach (preg_split('/\s+/u', trim($paragraph)) as $word) {
                $candidate = $line === '' ? $word : $line.' '.$word;
                if ($this->metrics->getTextWidth($candidate, $font, $size) <= $width) {
                    $line = $candidate;

                    continue;
                }
                if ($line !== '') {
                    $lines[] = $line;
                    $line = '';
                }
                foreach (mb_str_split($word) as $character) {
                    if ($line !== '' && $this->metrics->getTextWidth($line.$character, $font, $size) > $width) {
                        $lines[] = $line;
                        $line = '';
                    }
                    $line .= $character;
                }
            }
            $lines[] = $line;
        }

        return $lines ?: [''];
    }
}
