import { Injectable, type PipeTransform } from '@nestjs/common';

import { ValidationError } from '../../../../shared/domain/validation-error';
import { DomainHttpException } from '../../../../shared/infrastructure/http/domain-http.exception';

const DEPARTMENT_CODE = /^\d{2}$/;

/** DIVIPOLA department codes have exactly two digits (e.g. 05 for Antioquia). */
@Injectable()
export class DepartmentCodePipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (!DEPARTMENT_CODE.test(value)) {
      throw new DomainHttpException(
        ValidationError.forField('departmentCode', 'departmentCode must have exactly 2 digits'),
      );
    }
    return value;
  }
}
