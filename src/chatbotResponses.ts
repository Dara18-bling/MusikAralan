export type ChatbotResponse = {
  id: string;
  keywords: string;
  response: string;
  deleted?: boolean;
};

export const DEFAULT_CHATBOT_RESPONSES: ChatbotResponse[] = [
  {
    id: "join-class",
    keywords: "class meet join",
    response:
      'Tap "Live Classes" on the left, then the big blue "Join on Google Meet" button.',
  },
  {
    id: "download-pdf",
    keywords: "download pdf",
    response:
      "Open Materials, choose the lesson, then tap Download. It will work even without internet.",
  },
  {
    id: "general-help",
    keywords: "help support assist assistance",
    response:
      "What can I help with? You can ask me about joining a class, downloading a lesson, or using your account.",
  },
  {
    id: "fallback",
    keywords: "",
    response:
      "Salamat po! A coordinator will reply soon. You can also call Sis. Ethyl at 0917 123 4567.",
  },
];
