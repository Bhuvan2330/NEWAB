document.addEventListener("DOMContentLoaded", () => {
  const openButton = document.getElementById("workflowDialogOpen");
  const dialog = document.getElementById("workflowDialog");
  if (!openButton || !dialog) return;

  openButton.addEventListener("click", () => {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      alert("Workflow details:\n\n1. Vendor enquiry\n2. Vendor meeting & notes (Google Meet or Microsoft Teams)\n3. Vendor onboarding\n5. Project onboarding\n6. Requirement gathering\n7. Project kickoff");
    }
  });

  dialog.querySelectorAll("[data-close]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });

  dialog.addEventListener("click", (event) => {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) {
      dialog.close();
    }
  });
});
