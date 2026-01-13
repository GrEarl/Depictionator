type LlmContextProps = {
  value: unknown;
};

export function LlmContext({ value }: LlmContextProps) {
  const json = JSON.stringify(value ?? {});
  return (
    <script
      id="llm-context"
      type="application/json"
      dangerouslySetInnerHTML={{ __html: json.replace(/</g, "\\u003c") }}
    />
  );
}
