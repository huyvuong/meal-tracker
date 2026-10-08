"use client";

import { addDays, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { editedMealDateTime, localMealDateTime, mealDateUrl } from "@/lib/meal-date";
import { mealTypes, type MealFieldErrors } from "@/lib/meal-input";

import { updateMealAction } from "./actions";
import { useEditableMeal } from "./meal-context";

export default function EditMealPage() {
  const router = useRouter();
  const meal = useEditableMeal();
  const [mealType, setMealType] = useState<string | null>(meal.mealType);
  const [fieldErrors, setFieldErrors] = useState<MealFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const submitting = useRef(false);
  const dateInput = useRef<HTMLInputElement>(null);
  const typeTrigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    // Initialize in the browser so the field uses the device’s local time zone.
    if (dateInput.current) dateInput.current.value = localMealDateTime(new Date(meal.eatenAt));
  }, [meal.id, meal.eatenAt]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || submitting.current) return;
    const eatenAt = editedMealDateTime(dateInput.current?.value ?? "", meal.eatenAt);
    const errors: MealFieldErrors = {};
    if (!mealType) errors.mealType = "Choose a meal type.";
    if (!eatenAt) errors.eatenAt = "Enter a valid local date and time. Times skipped by daylight saving time are unavailable.";
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length || !eatenAt || !mealType) {
      if (errors.mealType) typeTrigger.current?.focus();
      else dateInput.current?.focus();
      return;
    }

    const start = startOfDay(eatenAt);
    submitting.current = true;
    startTransition(async () => {
      try {
        const result = await updateMealAction({
          mealId: meal.id,
          mealType,
          eatenAt: eatenAt.toISOString(),
          start: start.toISOString(),
          end: addDays(start, 1).toISOString(),
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        if (!result.success) {
          setError(result.message);
          setFieldErrors(result.fieldErrors ?? {});
          if (result.fieldErrors?.mealType) typeTrigger.current?.focus();
          else if (result.fieldErrors?.eatenAt) dateInput.current?.focus();
          return;
        }
        toast.success("Meal updated successfully.");
        startTransition(() => router.push(result.destination));
      } catch {
        setError("Unable to save the meal. Please try again.");
      } finally {
        submitting.current = false;
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 py-8 sm:py-12">
      <Card>
        <CardHeader>
          <CardTitle><h1>Edit meal</h1></CardTitle>
          <CardDescription>Update the meal type and time. Recorded foods and nutrition stay the same.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={submit} aria-busy={pending}>
            <FieldGroup>
              <Field data-invalid={Boolean(fieldErrors.mealType)}>
                <FieldLabel htmlFor="meal-type">Meal type</FieldLabel>
                <Select
                  items={mealTypes.map((value) => ({ value, label: value.charAt(0).toUpperCase() + value.slice(1) }))}
                  value={mealType}
                  onValueChange={(value) => {
                    setMealType(value);
                    setFieldErrors((current) => ({ ...current, mealType: undefined }));
                  }}
                  disabled={pending}
                  name="mealType"
                  required
                >
                  <SelectTrigger ref={typeTrigger} id="meal-type" aria-invalid={Boolean(fieldErrors.mealType)} aria-describedby={fieldErrors.mealType ? "meal-type-error" : undefined}>
                    <SelectValue placeholder="Choose a meal type" />
                  </SelectTrigger>
                  <SelectContent>
                    {mealTypes.map((value) => (
                      <SelectItem key={value} value={value}>{value.charAt(0).toUpperCase() + value.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError id="meal-type-error">{fieldErrors.mealType}</FieldError>
              </Field>
              <Field data-invalid={Boolean(fieldErrors.eatenAt)}>
                <FieldLabel htmlFor="eaten-at">Date and time</FieldLabel>
                <Input ref={dateInput} id="eaten-at" name="eatenAt" type="datetime-local" step={60} required disabled={pending} aria-invalid={Boolean(fieldErrors.eatenAt)} aria-describedby={`eaten-at-description${fieldErrors.eatenAt ? " eaten-at-error" : ""}`} onChange={() => setFieldErrors((current) => ({ ...current, eatenAt: undefined }))} />
                <FieldDescription id="eaten-at-description">Uses your device’s local time zone. Past and future meals are allowed.</FieldDescription>
                <FieldError id="eaten-at-error">{fieldErrors.eatenAt}</FieldError>
              </Field>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>{pending ? "Saving changes…" : "Save changes"}</Button>
                <Button type="button" variant="outline" disabled={pending} onClick={() => router.push(mealDateUrl(new Date(meal.eatenAt)))}>Cancel</Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
