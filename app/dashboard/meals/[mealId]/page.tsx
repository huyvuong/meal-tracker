"use client";

import { addDays, startOfDay } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertDialog, AlertDialogAction, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { calculateItemNutrition, summarizeMealNutrition, type Nutrition } from "@/db/nutrition";
import type { MealItemFieldErrors, MealItemResult } from "@/lib/meal-item-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { editedMealDateTime, localMealDateTime, mealDateUrl } from "@/lib/meal-date";
import { mealTypes, type MealFieldErrors } from "@/lib/meal-input";

import { updateMealAction, addMealItemAction, createAndLogFoodAction, updateMealItemQuantityAction, removeMealItemAction } from "./actions";
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

  const [createFood, setCreateFood] = useState(false);
  const [filter, setFilter] = useState("");
  const [foodId, setFoodId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [newFood, setNewFood] = useState({ name: "", caloriesPerUnit: "", proteinGPerUnit: "", carbsGPerUnit: "", fatGPerUnit: "" });
  const [foodErrors, setFoodErrors] = useState<MealItemFieldErrors>({});
  const [foodError, setFoodError] = useState<string | null>(null);
  const [draftQuantities, setDraftQuantities] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, { message: string; quantity?: string }>>({});
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [foodPending, startFoodTransition] = useTransition();
  const foodSubmitting = useRef(false);
  const createFoodMode = useRef<HTMLButtonElement>(null);
  const focusAfterSave = useRef<string | null>(null);
  const foodInputs = useRef<Record<string, HTMLElement | null>>({});
  const busy = pending || foodPending;
  const filteredFoods = meal.foods.filter((food) => food.name.toLocaleLowerCase().includes(filter.trim().toLocaleLowerCase()));
  const loggedFood = meal.items.find((item) => item.foodId === foodId);
  const totals = summarizeMealNutrition(meal.items);
  const nutrients = [
    { key: "calories", label: "Calories", unit: "kcal" },
    { key: "proteinG", label: "Protein", unit: "g" },
    { key: "carbsG", label: "Carbohydrates", unit: "g" },
    { key: "fatG", label: "Fat", unit: "g" },
  ] as const;
  const nutritionFields = [
    { key: "caloriesPerUnit", label: "Calories per unit (kcal)" },
    { key: "proteinGPerUnit", label: "Protein per unit (g)" },
    { key: "carbsGPerUnit", label: "Carbohydrates per unit (g)" },
    { key: "fatGPerUnit", label: "Fat per unit (g)" },
  ] as const;

  function nutritionText(nutrition: Nutrition, key: keyof Nutrition, unit: string) {
    return nutrition[key] === null ? "Unknown" : `${nutrition[key]} ${unit}`;
  }

  function saveFood(operation: () => Promise<MealItemResult>, message: string, itemId?: string, onSuccess?: () => void) {
    if (busy || submitting.current || foodSubmitting.current) return;
    foodSubmitting.current = true;
    if (itemId) setRowErrors((current) => { const next = { ...current }; delete next[itemId]; return next; });
    else { setFoodErrors({}); setFoodError(null); }
    startFoodTransition(async () => {
      try {
        const result = await operation();
        if (!result.success) {
          if (itemId) {
            setRowErrors((current) => ({ ...current, [itemId]: { message: result.message, quantity: result.fieldErrors?.quantity } }));
            if (result.fieldErrors?.quantity) focusAfterSave.current = `quantity-${itemId}`;
          } else {
            setFoodError(result.message);
            setFoodErrors(result.fieldErrors ?? {});
            focusAfterSave.current = Object.keys(result.fieldErrors ?? {})[0] ?? null;
          }
          return;
        }
        onSuccess?.();
        toast.success(message);
      } catch {
        const message = "Unable to save this food entry. Please try again.";
        if (itemId) setRowErrors((current) => ({ ...current, [itemId]: { message } }));
        else setFoodError(message);
      } finally {
        foodSubmitting.current = false;
      }
    });
  }

  function addFood(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loggedFood && !createFood) {
      setFoodError("This food is already logged. Edit its quantity below.");
      foodInputs.current[`quantity-${loggedFood.id}`]?.focus();
      return;
    }
    saveFood(
      () => createFood ? createAndLogFoodAction({
        mealId: meal.id, name: newFood.name, quantity,
        caloriesPerUnit: newFood.caloriesPerUnit.trim() || null,
        proteinGPerUnit: newFood.proteinGPerUnit.trim() || null,
        carbsGPerUnit: newFood.carbsGPerUnit.trim() || null,
        fatGPerUnit: newFood.fatGPerUnit.trim() || null,
      }) : addMealItemAction({ mealId: meal.id, foodId: foodId ?? "", quantity }),
      createFood ? "Food created and added to meal." : "Food added to meal.",
      undefined,
      () => {
        setQuantity("1"); setFoodId(null); setFilter("");
        setNewFood({ name: "", caloriesPerUnit: "", proteinGPerUnit: "", carbsGPerUnit: "", fatGPerUnit: "" });
      },
    );
  }

  useEffect(() => {
    // Initialize in the browser so the field uses the device’s local time zone.
    if (dateInput.current) dateInput.current.value = localMealDateTime(new Date(meal.eatenAt));
  }, [meal.id, meal.eatenAt]);

  useEffect(() => {
    // Wait for the controls to be enabled again before moving focus to an error.
    if (busy || !focusAfterSave.current) return;
    const key = focusAfterSave.current;
    const hasError = key.startsWith("quantity-")
      ? rowErrors[key.slice("quantity-".length)]?.quantity
      : foodErrors[key as keyof MealItemFieldErrors];
    const target = foodInputs.current[key];
    if (!hasError || !target || target.matches(":disabled") || !target.getClientRects().length) return;
    const frame = requestAnimationFrame(() => {
      target.focus();
      focusAfterSave.current = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [busy, foodErrors, rowErrors]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || submitting.current || foodSubmitting.current) return;
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-8 sm:py-12">
      <Card>
        <CardHeader>
          <CardTitle><h1>Edit meal</h1></CardTitle>
          <CardDescription>Update meal details and log foods. Food changes save immediately.</CardDescription>
        </CardHeader>
        <CardContent>
          <form noValidate onSubmit={submit} aria-busy={busy}>
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
                  disabled={busy}
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
                <Input ref={dateInput} id="eaten-at" name="eatenAt" type="datetime-local" step={60} required disabled={busy} aria-invalid={Boolean(fieldErrors.eatenAt)} aria-describedby={`eaten-at-description${fieldErrors.eatenAt ? " eaten-at-error" : ""}`} onChange={() => setFieldErrors((current) => ({ ...current, eatenAt: undefined }))} />
                <FieldDescription id="eaten-at-description">Uses your device’s local time zone. Past and future meals are allowed.</FieldDescription>
                <FieldError id="eaten-at-error">{fieldErrors.eatenAt}</FieldError>
              </Field>
              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={busy}>{pending ? "Saving changes…" : "Save changes"}</Button>
                <Button type="button" variant="outline" disabled={busy} onClick={() => router.push(mealDateUrl(new Date(meal.eatenAt)))}>Cancel</Button>
              </div>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><h2>Add food</h2></CardTitle>
          <CardDescription>Quantity counts food units: two apples have quantity 2. Blank nutrition means unknown; enter 0 for known zero.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap gap-2">
            <Button type="button" variant={createFood ? "outline" : "default"} aria-pressed={!createFood} disabled={busy} onClick={() => { setCreateFood(false); setFoodError(null); setFoodErrors({}); }}>Saved foods</Button>
            <Button ref={createFoodMode} id="create-food-mode" type="button" variant={createFood ? "default" : "outline"} aria-pressed={createFood} disabled={busy} onClick={() => { setCreateFood(true); setFoodError(null); setFoodErrors({}); }}>Create and add food</Button>
          </div>
          <form noValidate onSubmit={addFood} aria-busy={foodPending}>
            <FieldGroup>
              {createFood ? <>
                <Field data-invalid={Boolean(foodErrors.name)}>
                  <FieldLabel htmlFor="food-name">Food name</FieldLabel>
                  <Input ref={(node) => { foodInputs.current.name = node; }} id="food-name" value={newFood.name} maxLength={120} disabled={busy} aria-invalid={Boolean(foodErrors.name)} aria-describedby="food-name-description food-name-error" onChange={(event) => setNewFood((current) => ({ ...current, name: event.target.value }))} />
                  <FieldDescription id="food-name-description">Use a name such as Apple, without an amount. This food will be saved for future meals.</FieldDescription>
                  <FieldError id="food-name-error">{foodErrors.name}</FieldError>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  {nutritionFields.map(({ key, label }) => <Field key={key} data-invalid={Boolean(foodErrors[key])}>
                    <FieldLabel htmlFor={key}>{label} (optional)</FieldLabel>
                    <Input ref={(node) => { foodInputs.current[key] = node; }} id={key} inputMode="decimal" value={newFood[key]} disabled={busy} placeholder="Unknown" aria-invalid={Boolean(foodErrors[key])} aria-describedby={`${key}-error`} onChange={(event) => setNewFood((current) => ({ ...current, [key]: event.target.value }))} />
                    <FieldError id={`${key}-error`}>{foodErrors[key]}</FieldError>
                  </Field>)}
                </div>
              </> : <>
                <Field>
                  <FieldLabel htmlFor="food-filter">Filter saved foods</FieldLabel>
                  <Input id="food-filter" value={filter} disabled={busy} onChange={(event) => { setFilter(event.target.value); setFoodId(null); }} placeholder="Search by name" />
                </Field>
                <Field data-invalid={Boolean(foodErrors.foodId)}>
                  <FieldLabel htmlFor="saved-food">Saved food</FieldLabel>
                  <Select items={filteredFoods.map((food) => ({ value: food.id, label: food.name }))} value={foodId} onValueChange={setFoodId} disabled={busy || !filteredFoods.length}>
                    <SelectTrigger ref={(node) => { foodInputs.current.foodId = node; }} id="saved-food" className="w-full min-w-0" aria-invalid={Boolean(foodErrors.foodId)} aria-describedby="saved-food-description saved-food-error"><SelectValue placeholder="Choose a food" /></SelectTrigger>
                    <SelectContent>{filteredFoods.map((food) => <SelectItem key={food.id} value={food.id}>{food.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <FieldDescription id="saved-food-description">{!meal.foods.length ? "No saved foods yet. Create a food to start logging." : !filteredFoods.length ? "No foods match this filter." : "Only your active saved foods are listed."}</FieldDescription>
                  <FieldError id="saved-food-error">{foodErrors.foodId}</FieldError>
                </Field>
              </>}
              <Field data-invalid={Boolean(foodErrors.quantity)}>
                <FieldLabel htmlFor="food-quantity">Quantity (units)</FieldLabel>
                <Input ref={(node) => { foodInputs.current.quantity = node; }} id="food-quantity" inputMode="decimal" value={quantity} disabled={busy} aria-invalid={Boolean(foodErrors.quantity)} aria-describedby="food-quantity-description food-quantity-error" onChange={(event) => setQuantity(event.target.value)} />
                <FieldDescription id="food-quantity-description">Greater than zero, with up to three decimal places.</FieldDescription>
                <FieldError id="food-quantity-error">{foodErrors.quantity}</FieldError>
              </Field>
              {!createFood && loggedFood && <Alert><AlertDescription>This food is already logged. Edit its quantity below.<Button type="button" variant="link" disabled={busy} onClick={() => foodInputs.current[`quantity-${loggedFood.id}`]?.focus()}>Edit logged quantity</Button></AlertDescription></Alert>}
              {foodError && <Alert variant="destructive"><AlertDescription>{foodError}</AlertDescription></Alert>}
              <Button type="submit" disabled={busy || (!createFood && (!foodId || Boolean(loggedFood)))}>{foodPending ? "Saving…" : createFood ? "Create and add food" : "Add food"}</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle><h2>Logged foods</h2></CardTitle>
          <CardDescription>Nutrition uses the values saved when each food was logged. Save quantities explicitly.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {!meal.items.length ? <Empty><EmptyHeader><EmptyTitle>No foods logged</EmptyTitle><EmptyDescription>Add a saved food or create one above. This meal is an empty draft.</EmptyDescription></EmptyHeader></Empty> : meal.items.map((item) => {
            const nutrition = calculateItemNutrition(item);
            const rowError = rowErrors[item.id];
            return <Card key={item.id}>
              <CardHeader>
                <CardTitle><h3 className="break-words">{item.foodNameSnapshot}</h3></CardTitle>
                <CardDescription>Logged quantity: {item.quantity} units</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  {nutrients.map(({ key, label, unit }) => <div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{nutritionText(nutrition, key, unit)}</dd></div>)}
                </dl>
                <form noValidate aria-busy={foodPending} className="flex flex-col gap-3" onSubmit={(event) => {
                  event.preventDefault();
                  saveFood(() => updateMealItemQuantityAction({ mealId: meal.id, itemId: item.id, quantity: draftQuantities[item.id] ?? item.quantity }), "Quantity saved.", item.id, () => setDraftQuantities((current) => { const next = { ...current }; delete next[item.id]; return next; }));
                }}>
                  <Field data-invalid={Boolean(rowError?.quantity)}>
                    <FieldLabel htmlFor={`quantity-${item.id}`}>Quantity for {item.foodNameSnapshot}</FieldLabel>
                    <Input ref={(node) => { foodInputs.current[`quantity-${item.id}`] = node; }} id={`quantity-${item.id}`} inputMode="decimal" disabled={busy} value={draftQuantities[item.id] ?? item.quantity} aria-invalid={Boolean(rowError?.quantity)} aria-describedby={rowError?.quantity ? `quantity-error-${item.id}` : undefined} onChange={(event) => setDraftQuantities((current) => ({ ...current, [item.id]: event.target.value }))} />
                    <FieldError id={`quantity-error-${item.id}`}>{rowError?.quantity}</FieldError>
                  </Field>
                  {rowError && <Alert variant="destructive"><AlertDescription>{rowError.message}</AlertDescription></Alert>}
                  <div className="flex flex-wrap gap-2">
                    <Button type="submit" disabled={busy}>Save quantity</Button>
                    <AlertDialog open={removeId === item.id} onOpenChange={(open) => { if (!foodSubmitting.current) setRemoveId(open ? item.id : null); }}>
                      <AlertDialogTrigger render={<Button type="button" variant="outline" disabled={busy} />}>Remove<span className="sr-only"> {item.foodNameSnapshot}</span></AlertDialogTrigger>
                      <AlertDialogContent finalFocus={() => foodInputs.current[`quantity-${item.id}`] ? true : createFoodMode.current}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove {item.foodNameSnapshot}?</AlertDialogTitle>
                          <AlertDialogDescription>This removes the entry from this meal. The saved food remains available. Removing the last entry leaves an empty draft.</AlertDialogDescription>
                        </AlertDialogHeader>
                        {rowError && <Alert variant="destructive"><AlertDescription>{rowError.message}</AlertDescription></Alert>}
                        <AlertDialogFooter>
                          <AlertDialogCancel disabled={busy}>Keep food</AlertDialogCancel>
                          <AlertDialogAction type="button" variant="destructive" disabled={busy} onClick={() => saveFood(() => removeMealItemAction({ mealId: meal.id, itemId: item.id }), "Food removed from meal.", item.id, () => setRemoveId(null))}>{foodPending ? "Removing…" : "Remove food"}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </form>
              </CardContent>
            </Card>;
          })}
        </CardContent>
      </Card>
      {meal.items.length > 0 && <Card>
        <CardHeader><CardTitle><h2>Meal totals</h2></CardTitle><CardDescription>A nutrient total is unknown when any logged food has no value for it.</CardDescription></CardHeader>
        <CardContent><dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">{nutrients.map(({ key, label, unit }) => <div key={key}><dt className="text-muted-foreground">{label}</dt><dd className="break-words">{nutritionText(totals, key, unit)}</dd></div>)}</dl></CardContent>
      </Card>}
    </main>
  );
}
