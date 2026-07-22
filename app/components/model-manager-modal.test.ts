import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.join(process.cwd(), "app/components/model-manager.tsx"),
  "utf8",
);

test("renders the add-model dialog inside the global modal mask", () => {
  expect(source).toMatch(
    /\{showAddModal && \(\s*<div className=\"modal-mask\">\s*<Modal/s,
  );
});
