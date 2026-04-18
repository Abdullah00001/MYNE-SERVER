/**
 * Base Data Transfer Object (DTO) class.
 *
 * Provides a standard pattern for creating DTOs from entities.
 * Intended for shaping responses; not for input validation.
 *
 * @template T - Source entity type.
 */

export abstract class BaseDTO<T> {
  /**
   * Initialize DTO from the given entity.
   * @param entity - The source entity object.
   */
  constructor(entity: T) {}

  /**
   * Factory method to create a DTO instance from an entity.
   * Automatically instantiates the subclass.
   *
   * @template T - Entity type
   * @template D - DTO subclass type
   * @param this - DTO subclass constructor
   * @param entity - Entity to convert
   * @returns Instance of the DTO subclass
   */
  static fromEntity<T, D>(this: new (entity: T) => D, entity: T): D {
    return new this(entity);
  }
}
