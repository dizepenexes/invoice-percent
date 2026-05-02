"use client";

import { useState } from "react";
import Tesseract from "tesseract.js";

type AmountRow = {
  id: number;
  value: string;
};

type ResultRow = {
  id: number;
  original: number;
  result: number;
  percent: number;
   weight?: number;
};

function extractAmounts(text: string): AmountRow[] {
  const matches = text.match(/\d+[.,]?\d*/g) ?? [];

  return matches
    .map((item, index) => ({
      id: index + 1,
      value: item.replace(",", "."),
    }))
    .filter((item) => !Number.isNaN(Number(item.value)));
}

function calculateWithPercent(amounts: AmountRow[], percent: number): ResultRow[] {
  return amounts
    .map((item) => {
      const original = Number(item.value);

      return {
        id: item.id,
        original,
        result: original * (1 + percent / 100),
        percent,
      };
    })
    .filter((item) => !Number.isNaN(item.original));
}

export default function Home() {
  const [imagePreview, setImagePreview] = useState<string>("");
  const [amounts, setAmounts] = useState<AmountRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [customPercent, setCustomPercent] = useState("23");
  const [weight, setWeight] = useState("");
  const [weightPercent, setWeightPercent] = useState("23");

  async function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    setAmounts([]);
    setResults([]);
    setIsConfirmed(false);
    setProgress(0);
    setIsRecognizing(true);

    try {
      const response = await Tesseract.recognize(file, "eng", {
        logger: (message) => {
          if (message.status === "recognizing text") {
            setProgress(Math.round(message.progress * 100));
          }
        },
      });

      const foundAmounts = extractAmounts(response.data.text);
      setAmounts(foundAmounts);
    } catch {
      alert("Не вдалося розпізнати фото. Спробуйте зробити чіткіше фото.");
    } finally {
      setIsRecognizing(false);
    }
  }

  function updateAmount(id: number, value: string) {
    setAmounts((currentAmounts) =>
      currentAmounts.map((item) =>
        item.id === id ? { ...item, value } : item
      )
    );

    setResults([]);
  }

  function removeAmount(id: number) {
    setAmounts((currentAmounts) =>
      currentAmounts.filter((item) => item.id !== id)
    );

    setResults([]);
  }

  function addEmptyAmount() {
    setAmounts((currentAmounts) => [
      ...currentAmounts,
      {
        id: currentAmounts.length + 1,
        value: "",
      },
    ]);

    setResults([]);
  }

  function handleCalculate(percent: number) {
    const calculatedResults = calculateWithPercent(amounts, percent);
    setResults(calculatedResults);
  }

  function handleCustomCalculate() {
    const percent = Number(customPercent.replace(",", "."));

    if (Number.isNaN(percent)) {
      alert("Введіть правильний відсоток.");
      return;
    }

    handleCalculate(percent);
  }

  function handleWeightCalculate() {
  const parsedWeight = Number(weight.replace(",", "."));
  const parsedPercent = Number(weightPercent.replace(",", "."));

  if (Number.isNaN(parsedWeight) || parsedWeight <= 0) {
    alert("Введіть правильну вагу.");
    return;
  }

  if (Number.isNaN(parsedPercent)) {
    alert("Введіть правильний відсоток.");
    return;
  }

  const calculatedResults = amounts
    .map((item) => {
      const original = Number(item.value);
      const pricePerKg = original / parsedWeight;

      return {
        id: item.id,
        original,
        weight: parsedWeight,
        percent: parsedPercent,
        result: pricePerKg * (1 + parsedPercent / 100),
      };
    })
    .filter((item) => !Number.isNaN(item.original));

  setResults(calculatedResults);
}

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#edf2f8] px-4 py-6 text-slate-900">
      <div className="pointer-events-none absolute left-[-120px] top-[-120px] h-80 w-80 rounded-full bg-blue-300/40 blur-3xl" />
      <div className="pointer-events-none absolute right-[-100px] top-40 h-72 w-72 rounded-full bg-purple-300/40 blur-3xl" />
      <div className="pointer-events-none absolute bottom-[-120px] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-cyan-300/30 blur-3xl" />

      <div className="relative mx-auto max-w-xl">
        <div className="mb-5 rounded-[2rem] border border-white/60 bg-white/45 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-2xl">
          <div className="mb-5">
            <div className="mb-3 inline-flex rounded-full border border-white/60 bg-white/50 px-3 py-1 text-xs font-semibold text-blue-700 shadow-sm backdrop-blur">
              
            </div>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Розрахунок накладної
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Завантажте фото стовпчика з сумами, перевірте розпізнані значення
              і додайте потрібний відсоток.
            </p>
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Фото накладної
            </span>

            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="block w-full rounded-2xl border border-white/70 bg-white/60 px-4 py-3 text-sm shadow-inner backdrop-blur-xl file:mr-3 file:rounded-xl file:border-0 file:bg-blue-500 file:px-4 file:py-2 file:font-semibold file:text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </label>

          {imagePreview && (
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/40 p-2 shadow-inner backdrop-blur-xl">
              <img
                src={imagePreview}
                alt="Фото накладної"
                className="max-h-80 w-full rounded-[1.2rem] object-contain"
              />
            </div>
          )}

          {isRecognizing && (
            <div className="mt-5 rounded-2xl border border-yellow-200/70 bg-yellow-50/70 p-4 text-sm font-medium text-yellow-800 shadow-sm backdrop-blur-xl">
              <div className="mb-2 flex justify-between">
                <span>Розпізнавання фото...</span>
                <span>{progress}%</span>
              </div>

              <div className="h-2 overflow-hidden rounded-full bg-yellow-200/70">
                <div
                  className="h-full rounded-full bg-yellow-500 transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {amounts.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-xl font-bold text-slate-950">
                Знайдені суми
              </h2>

              <div className="space-y-3">
                {amounts.map((item, index) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/55 p-2 shadow-sm backdrop-blur-xl"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900/90 text-sm font-bold text-white shadow">
                      {index + 1}
                    </span>

                    <input
                      value={item.value}
                      onChange={(event) =>
                        updateAmount(item.id, event.target.value)
                      }
                      inputMode="decimal"
                      className="w-full rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-base font-semibold shadow-inner backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />

                    <button
                      onClick={() => removeAmount(item.id)}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/85 text-xl font-bold text-white shadow-md transition active:scale-90"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={addEmptyAmount}
                className="mt-4 w-full rounded-2xl border border-white/70 bg-white/55 px-4 py-3 font-semibold text-slate-800 shadow-sm backdrop-blur-xl transition active:scale-[0.98]"
              >
                + Додати суму вручну
              </button>

              {!isConfirmed ? (
                <div className="mt-5 rounded-[1.5rem] border border-white/70 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
                  <p className="mb-3 font-semibold text-slate-800">
                    Чи все вірно?
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => setIsConfirmed(true)}
                      className="rounded-2xl bg-blue-500 px-4 py-3 font-bold text-white shadow-lg shadow-blue-500/25 transition active:scale-95"
                    >
                      Так
                    </button>

                    <button
                      onClick={() => setIsConfirmed(false)}
                      className="rounded-2xl border border-white/70 bg-white/70 px-4 py-3 font-bold text-slate-800 shadow-sm backdrop-blur transition active:scale-95"
                    >
                      Ні, редагувати
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-[1.5rem] border border-white/70 bg-white/55 p-4 shadow-sm backdrop-blur-xl">
                  <p className="mb-3 font-semibold text-slate-800">
                    Оберіть дію
                  </p>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={() => handleCalculate(23)}
                      className="rounded-2xl bg-emerald-500 px-4 py-3 font-bold text-white shadow-lg shadow-emerald-500/25 transition active:scale-95"
                    >
                      Додати 23%
                    </button>

                    <button
                      onClick={() => handleCalculate(25)}
                      className="rounded-2xl bg-emerald-500 px-4 py-3 font-bold text-white shadow-lg shadow-emerald-500/25 transition active:scale-95"
                    >
                      Додати 25%
                    </button>
                    
                  </div>

                  <div className="mt-4 rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-xl">
  <p className="mb-3 text-sm font-semibold text-slate-700">
    Для товару на вагу
  </p>

  <div className="grid grid-cols-2 gap-2">
    <input
      value={weight}
      onChange={(event) => setWeight(event.target.value)}
      inputMode="decimal"
      className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3 font-semibold shadow-inner backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-400"
      placeholder="Вага, кг"
    />

    <input
      value={weightPercent}
      onChange={(event) => setWeightPercent(event.target.value)}
      inputMode="decimal"
      className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3 font-semibold shadow-inner backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-400"
      placeholder="Відсоток"
    />
  </div>

  <button
    onClick={handleWeightCalculate}
    className="mt-3 w-full rounded-2xl bg-purple-500 px-5 py-3 font-bold text-white shadow-lg shadow-purple-500/25 transition active:scale-95"
  >
    Поділити на вагу і додати %
  </button>
</div>

                  <div className="mt-3 flex gap-2">
                    <input
                      value={customPercent}
                      onChange={(event) => setCustomPercent(event.target.value)}
                      inputMode="decimal"
                      className="w-full rounded-2xl border border-white/70 bg-white/70 px-4 py-3 font-semibold shadow-inner backdrop-blur focus:outline-none focus:ring-2 focus:ring-blue-400"
                      placeholder="Свій %"
                    />

                    <button
                      onClick={handleCustomCalculate}
                      className="rounded-2xl bg-blue-500 px-5 py-3 font-bold text-white shadow-lg shadow-blue-500/25 transition active:scale-95"
                    >
                      Додати
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {results.length > 0 && (
            <section className="mt-6">
              <h2 className="mb-3 text-xl font-bold text-slate-950">
                Результат
              </h2>

              <div className="space-y-3">
                {results.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-white/70 bg-white/60 p-4 shadow-sm backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500 text-sm font-bold text-white">
                        {index + 1}
                      </span>

                      <div className="flex-1 text-right text-base">
                    {item.weight ? (
                      <>
                        <span className="font-medium text-slate-600">
                          {item.original.toFixed(2)} / {item.weight.toFixed(3)} кг
                        </span>{" "}
                    
                        <span className="text-blue-500 font-semibold">
                          + {item.percent}%
                        </span>{" "}
                    
                        <span className="text-slate-400">→</span>{" "}
                    
                        <span className="text-lg font-bold text-slate-950">
                          {item.result.toFixed(2)}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-medium text-slate-600">
                          {item.original.toFixed(2)}
                        </span>{" "}
                    
                        <span className="text-blue-500 font-semibold">
                          + {item.percent}%
                        </span>{" "}
                    
                        <span className="text-slate-400">→</span>{" "}
                    
                        <span className="text-lg font-bold text-slate-950">
                          {item.result.toFixed(2)}
                        </span>
                      </>
                    )}
                  </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-blue-200/70 bg-blue-500/10 p-5 text-lg font-bold text-blue-900 shadow-sm backdrop-blur-xl">
                Загальна сума:{" "}
                {results
                  .reduce((sum, item) => sum + item.result, 0)
                  .toFixed(2)}
              </div>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}