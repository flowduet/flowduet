export const rulesFor = (n: number) =>
  JSON.stringify([
    {
      type: "input",
      field: "subject",
      title: `事项${n}`,
      value: `原始${n}`,
      props: { placeholder: "输入事项" },
    },
    {
      type: "input",
      field: "notes",
      title: "说明",
      props: { type: "textarea", placeholder: "输入说明" },
    },
    { type: "inputNumber", field: "amount", title: "金额", value: 1 },
    {
      type: "radio",
      field: "priority",
      title: "级别",
      options: [
        { label: "一般", value: "normal" },
        { label: "紧急", value: "urgent" },
      ],
    },
    {
      type: "checkbox",
      field: "areas",
      title: "地区",
      options: [
        { label: "广州", value: "gz" },
        { label: "深圳", value: "sz" },
      ],
    },
    {
      type: "select",
      field: "department",
      title: "部门",
      options: [
        { label: "研发", value: "dev" },
        { label: "采购", value: "buy" },
      ],
    },
    { type: "datePicker", field: "date", title: "日期" },
    { type: "switch", field: "urgent", title: "加急", value: false },
  ]);
