export class NotFoundError extends Error {
  public readonly code = 'NOT_FOUND' as const;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class BusinessRuleError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'BUSINESS_RULE_VIOLATION') {
    super(message);
    this.name = 'BusinessRuleError';
    this.code = code;
  }
}

export class ConflictError extends Error {
  public readonly code: string;

  constructor(message: string, code = 'CONFLICT') {
    super(message);
    this.name = 'ConflictError';
    this.code = code;
  }
}
