import type {
  BasicFormField, ComponentSchema, FormFieldInputProps, FormFieldStoredValue,
  ObjectField, ParsedValueForComponentSchema,
} from "@keystatic/core";
import type { z } from "astro/zod";
import { createElement, useEffect, useId, useRef, useState, type ReactElement } from "react";

/** Keep the native editor and storage, adding the validation Keystatic runs before saving. */
export function withValidation<Value extends {} | null>(
  field: BasicFormField<Value>,
  errorFor: (value: Value) => string | undefined,
): BasicFormField<Value> {
  const validate = (value: Value): Value => {
    const result = field.validate(value);
    const error = errorFor(result);
    if (error) throw new Error(error);
    return result;
  };
  return {
    ...field,
    validate,
    reader: { parse: value => validate(field.reader.parse(value)) },
    Input(props) {
      const errorId = useId();
      const error = props.forceValidation ? errorFor(props.value) : undefined;
      return createElement(
        "div",
        { role: "group", "aria-label": field.label, "aria-describedby": error ? errorId : undefined },
        createElement(field.Input, props),
        error && createElement("p", { id: errorId, role: "alert" }, error),
      );
    },
  };
}

// Keystatic's object fields have no validation hook. These three optional work sections
// use a form field so the whole section can validate without changing its YAML shape.
type Mode = "default" | "parse" | "serialize";

function transform(field: ComponentSchema, value: unknown, mode: Mode): FormFieldStoredValue {
  if (mode === "parse" && value === null) value = undefined;
  if (field.kind === "form" && (field.formKind === undefined || field.formKind === "slug")) {
    if (mode === "default") return field.defaultValue();
    return mode === "parse"
      ? field.parse(value as FormFieldStoredValue, undefined)
      : field.serialize(value).value;
  }
  if (field.kind === "object") {
    const record = (value ?? {}) as Record<string, FormFieldStoredValue>;
    if (typeof record !== "object" || Array.isArray(record)) throw new Error("Rubrique invalide");
    for (const key of Object.keys(record)) {
      if (!(key in field.fields)) throw new Error(`Champ inconnu : ${key}`);
    }
    return Object.fromEntries(Object.entries(field.fields).flatMap(([key, child]) => {
      const result = transform(child, record[key], mode);
      return result === undefined ? [] : [[key, result]];
    }));
  }
  if (field.kind === "array") {
    if (mode === "default" || value === undefined) return [];
    if (!Array.isArray(value)) throw new Error("Liste invalide");
    return value.map(item => transform(field.element, item, mode) ?? null);
  }
  throw new Error(`Champ non pris en charge dans une rubrique facultative : ${field.kind}`);
}

type EditorProps = FormFieldInputProps<unknown> & { field: ComponentSchema };

function ArrayEditor({ field, value, onChange, forceValidation }: EditorProps & {
  field: Extract<ComponentSchema, { kind: "array" }>;
}): ReactElement {
  const items = value as unknown[];
  const counter = useRef(0);
  const [keys, setKeys] = useState(() => items.map(() => counter.current++));
  const rows = useRef(new Map<number, HTMLDivElement>());
  const addButton = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<number | "add" | null>(null);
  useEffect(() => {
    // Discarding edits can replace the whole value, independently of the list controls.
    setKeys(old => old.length === items.length ? old : items.map((_, i) => old[i] ?? counter.current++));
  }, [items.length]);
  useEffect(() => {
    const target = pendingFocus.current;
    if (target === null) return;
    const control = target === "add"
      ? addButton.current
      : rows.current.get(target)?.querySelector<HTMLElement>("input, textarea, select, button");
    control?.focus();
    pendingFocus.current = null;
  }, [keys]);
  const move = (from: number, to: number) => {
    const nextItems = [...items];
    const nextKeys = [...keys];
    [nextItems[from], nextItems[to]] = [nextItems[to], nextItems[from]];
    [nextKeys[from], nextKeys[to]] = [nextKeys[to], nextKeys[from]];
    setKeys(nextKeys);
    onChange(nextItems);
  };
  return createElement("fieldset", { style: { border: 0, padding: 0, margin: 0 } },
    createElement("legend", null, field.label),
    items.map((item, i) => createElement("div", {
      key: keys[i] ?? i, style: { marginBlock: "1rem" },
      ref: (row: HTMLDivElement | null) => {
        if (row) rows.current.set(keys[i] ?? i, row);
        else rows.current.delete(keys[i] ?? i);
      },
    },
      createElement(SectionEditor, {
        field: field.element, value: item, forceValidation, autoFocus: false,
        onChange: next => onChange(items.map((old, j) => j === i ? next : old)),
      }),
      createElement("button", {
        type: "button", disabled: i === 0, "aria-label": `Monter : ${field.label}, élément ${i + 1}`,
        onClick: () => move(i, i - 1),
      }, "Monter"),
      createElement("button", {
        type: "button", disabled: i === items.length - 1, "aria-label": `Descendre : ${field.label}, élément ${i + 1}`,
        onClick: () => move(i, i + 1),
      }, "Descendre"),
      createElement("button", {
        type: "button", "aria-label": `Supprimer : ${field.label}, élément ${i + 1}`,
        onClick: () => {
          pendingFocus.current = keys[i + 1] ?? keys[i - 1] ?? "add";
          setKeys(keys.filter((_, j) => j !== i));
          onChange(items.filter((_, j) => j !== i));
        },
      }, "Supprimer"),
    )),
    createElement("button", {
      ref: addButton, type: "button", "aria-label": `Ajouter : ${field.label}`,
      onClick: () => {
        const key = counter.current++;
        pendingFocus.current = key;
        setKeys([...keys, key]);
        onChange([...items, transform(field.element, undefined, "default")]);
      },
    }, "Ajouter"),
  );
}

function SectionEditor({ field, value, onChange, autoFocus, forceValidation }: EditorProps): ReactElement | null {
  if (field.kind === "form" && (field.formKind === undefined || field.formKind === "slug")) {
    return createElement(field.Input, { value, onChange, autoFocus, forceValidation });
  }
  if (field.kind === "object") {
    const entries = Object.entries(field.fields);
    const record = value as Record<string, unknown>;
    return createElement("fieldset", { style: { border: 0, padding: 0, margin: 0, display: "grid", gap: "1rem" } },
      field.label && createElement("legend", null, field.label),
      field.description && createElement("p", null, field.description),
      entries.map(([key, child], i) => createElement(SectionEditor, {
        key, field: child, value: record[key], forceValidation, autoFocus: autoFocus && i === 0,
        onChange: next => onChange({ ...record, [key]: next }),
      })),
    );
  }
  if (field.kind === "array") {
    return createElement(ArrayEditor, { field, value, onChange, autoFocus, forceValidation });
  }
  return null;
}

export function validatedObject<Fields extends Record<string, ComponentSchema>>(
  object: ObjectField<Fields>,
  schema: z.ZodType,
): BasicFormField<ParsedValueForComponentSchema<ObjectField<Fields>>> & { fields: Fields } {
  type Value = ParsedValueForComponentSchema<ObjectField<Fields>>;
  const parse = (raw: FormFieldStoredValue) => transform(object, raw, "parse") as Value;
  const field: BasicFormField<Value> = {
    kind: "form",
    label: object.label,
    defaultValue: () => transform(object, undefined, "default") as Value,
    parse,
    serialize: value => ({ value: transform(object, value, "serialize") }),
    validate: value => value,
    reader: { parse },
    Input: props => createElement(SectionEditor, { ...props, field: object }),
  };
  return {
    ...withValidation(field, value => {
      const result = schema.safeParse(value);
      if (result.success) return undefined;
      const issue = result.error.issues[0];
      let child: ComponentSchema = object;
      for (const key of issue.path) {
        if (child.kind === "object") child = child.fields[String(key)] ?? child;
        else if (child.kind === "array") child = child.element;
      }
      const label = "label" in child ? child.label : object.label;
      return `${label} : ${issue.code === "too_small" || issue.code === "invalid_value" ? "renseignez ce champ." : issue.message}`;
    }),
    fields: object.fields,
  };
}
