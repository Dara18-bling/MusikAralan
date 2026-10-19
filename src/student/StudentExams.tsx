import { Card, Title } from "../ui";

interface StudentExamsProps {
  userName: string;
}

export function StudentExams({ userName }: StudentExamsProps) {
  return (
    <>
      <Title kicker="Testing & achievements" title="Assessments" />
      <Card>
        <p>Assessment module placeholder for {userName}.</p>
      </Card>
    </>
  );
}