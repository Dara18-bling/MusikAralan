<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const LEGACY_TO_API_BOOK_IDS = [
        'genesis' => 'GEN',
        'exodus' => 'EXO',
        'leviticus' => 'LEV',
        'numbers' => 'NUM',
        'deuteronomy' => 'DEU',
        'joshua' => 'JOS',
        'judges' => 'JDG',
        'ruth' => 'RUT',
        '1-samuel' => '1SA',
        '2-samuel' => '2SA',
        '1-kings' => '1KI',
        '2-kings' => '2KI',
        '1-chronicles' => '1CH',
        '2-chronicles' => '2CH',
        'ezra' => 'EZR',
        'nehemiah' => 'NEH',
        'esther' => 'EST',
        'job' => 'JOB',
        'psalms' => 'PSA',
        'proverbs' => 'PRO',
        'ecclesiastes' => 'ECC',
        'song-of-solomon' => 'SNG',
        'isaiah' => 'ISA',
        'jeremiah' => 'JER',
        'lamentations' => 'LAM',
        'ezekiel' => 'EZK',
        'daniel' => 'DAN',
        'hosea' => 'HOS',
        'joel' => 'JOL',
        'amos' => 'AMO',
        'obadiah' => 'OBA',
        'jonah' => 'JON',
        'micah' => 'MIC',
        'nahum' => 'NAM',
        'habakkuk' => 'HAB',
        'zephaniah' => 'ZEP',
        'haggai' => 'HAG',
        'zechariah' => 'ZEC',
        'malachi' => 'MAL',
        'matthew' => 'MAT',
        'mark' => 'MRK',
        'luke' => 'LUK',
        'john' => 'JHN',
        'acts' => 'ACT',
        'romans' => 'ROM',
        '1-corinthians' => '1CO',
        '2-corinthians' => '2CO',
        'galatians' => 'GAL',
        'ephesians' => 'EPH',
        'philippians' => 'PHP',
        'colossians' => 'COL',
        '1-thessalonians' => '1TH',
        '2-thessalonians' => '2TH',
        '1-timothy' => '1TI',
        '2-timothy' => '2TI',
        'titus' => 'TIT',
        'philemon' => 'PHM',
        'hebrews' => 'HEB',
        'james' => 'JAS',
        '1-peter' => '1PE',
        '2-peter' => '2PE',
        '1-john' => '1JN',
        '2-john' => '2JN',
        '3-john' => '3JN',
        'jude' => 'JUD',
        'revelation' => 'REV',
    ];

    public function up(): void
    {
        $apiBookIds = array_values(self::LEGACY_TO_API_BOOK_IDS);
        foreach (DB::table('gospel_verses')->orderBy('id')->get() as $reference) {
            $bookId = self::LEGACY_TO_API_BOOK_IDS[$reference->book] ?? $reference->book;
            if (! in_array($bookId, $apiBookIds, true)) {
                DB::table('gospel_verses')->where('id', $reference->id)->delete();

                continue;
            }

            $duplicateExists = DB::table('gospel_verses')
                ->where('book', $bookId)
                ->where('chapter', $reference->chapter)
                ->where('verse', $reference->verse)
                ->where('id', '!=', $reference->id)
                ->exists();
            if ($duplicateExists) {
                DB::table('gospel_verses')->where('id', $reference->id)->delete();

                continue;
            }

            if ($reference->book !== $bookId) {
                DB::table('gospel_verses')
                    ->where('id', $reference->id)
                    ->update(['book' => $bookId, 'updated_at' => now()]);
            }
        }

        foreach ([
            ['JHN', 3, 16],
            ['PSA', 23, 1],
            ['PRO', 3, 5],
            ['PHP', 4, 13],
            ['ROM', 8, 28],
            ['MAT', 5, 16],
        ] as [$book, $chapter, $verse]) {
            DB::table('gospel_verses')->updateOrInsert(
                ['book' => $book, 'chapter' => $chapter, 'verse' => $verse],
                ['created_at' => now(), 'updated_at' => now()],
            );
        }
    }

    public function down(): void
    {
        $apiToLegacyBookIds = array_flip(self::LEGACY_TO_API_BOOK_IDS);
        foreach (DB::table('gospel_verses')->orderBy('id')->get() as $reference) {
            $legacyBookId = $apiToLegacyBookIds[$reference->book] ?? null;
            if ($legacyBookId === null) {
                DB::table('gospel_verses')->where('id', $reference->id)->delete();

                continue;
            }

            $duplicateExists = DB::table('gospel_verses')
                ->where('book', $legacyBookId)
                ->where('chapter', $reference->chapter)
                ->where('verse', $reference->verse)
                ->where('id', '!=', $reference->id)
                ->exists();
            if ($duplicateExists) {
                DB::table('gospel_verses')->where('id', $reference->id)->delete();

                continue;
            }

            if ($reference->book !== $legacyBookId) {
                DB::table('gospel_verses')
                    ->where('id', $reference->id)
                    ->update(['book' => $legacyBookId, 'updated_at' => now()]);
            }
        }
    }
};
