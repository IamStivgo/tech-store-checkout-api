import { ok, type Result } from '../../../shared/domain/result';
import type { CoverageRepository } from '../domain/coverage.repository.port';
import type { Department } from '../domain/location';

export class ListDepartments {
  constructor(private readonly coverage: CoverageRepository) {}

  execute(): Result<Department[], never> {
    return ok(this.coverage.listDepartments());
  }
}
