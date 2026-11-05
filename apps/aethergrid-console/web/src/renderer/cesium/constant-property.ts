import { ConstantProperty, type Property } from 'cesium';

// Cesium compares constant values before raising definitionChanged. Reusing the
// property avoids invalidating graphics every live tick when their values match.
export function updateConstantProperty<K extends string>(
  owner: Partial<Record<K, Property>>,
  key: K,
  value: unknown,
): void {
  const current = owner[key];
  if (current instanceof ConstantProperty) current.setValue(value);
  else owner[key] = new ConstantProperty(value);
}
