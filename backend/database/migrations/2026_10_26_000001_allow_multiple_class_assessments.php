
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // First, create a regular index to preserve the foreign key.
        Schema::table('assessments', function (Blueprint $table) {
            $table->index('class_id', 'assessments_class_id_index');
        });

        // Then remove the old unique constraint.
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropUnique('assessments_class_id_unique');

            $table->string('assessment_code', 32)->default('A1')->after('class_id');

            $table->unique(
                ['class_id', 'assessment_code'],
                'assessments_class_id_assessment_code_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::table('assessments', function (Blueprint $table) {
            $table->dropUnique('assessments_class_id_assessment_code_unique');
            $table->dropColumn('assessment_code');

            $table->unique('class_id', 'assessments_class_id_unique');
        });

        Schema::table('assessments', function (Blueprint $table) {
            $table->dropIndex('assessments_class_id_index');
        });
    }
};
