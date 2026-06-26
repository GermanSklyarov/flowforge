type WorkflowValidationResult = {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
};

const validateButton = document.querySelector<HTMLButtonElement>('.secondary');

validateButton?.addEventListener('click', async () => {
  const response = await fetch('http://localhost:4000/workflows/validate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Email summary workflow',
      nodes: [
        { id: 'email', type: 'source.email' },
        { id: 'extract', type: 'transform.extractText' },
        { id: 'llm', type: 'ai.llm' },
        { id: 'decision', type: 'logic.decision' },
        { id: 'task', type: 'task.create' },
        { id: 'telegram', type: 'notification.telegram' }
      ],
      edges: [
        { from: 'email', to: 'extract' },
        { from: 'extract', to: 'llm' },
        { from: 'llm', to: 'decision' },
        { from: 'decision', to: 'task' },
        { from: 'task', to: 'telegram' }
      ]
    })
  });

  const result = (await response.json()) as WorkflowValidationResult;
  validateButton.textContent = result.valid ? 'Valid' : 'Invalid';
  setTimeout(() => {
    validateButton.textContent = 'Validate';
  }, 1600);
});

