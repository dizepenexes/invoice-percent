"use client";

import { useRef, useState } from "react";
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

type Point = {
  x: number;
  y: number;
};

function extractAmounts(text: string): AmountRow[] {
  const parts = text
    .split(/\s+/)
    .map((part) =>
      part
        .replace(/[^0-9.,]/g, "")
        .replace(",", ".")
    )
    .filter(Boolean);

  const amounts: AmountRow[] = [];

  for (const part of parts) {
    let value = part;

    if (/^\d+\.\d{2}$/.test(value)) {
      amounts.push({
        id: amounts.length + 1,
        value,
      });
      continue;
    }

    if (/^\d{3,6}$/.test(value)) {
      value = `${value.slice(0, -2)}.${value.slice(-2)}`;

      amounts.push({
        id: amounts.length + 1,
        value,
      });
    }
  }

  return amounts;
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

async function getImageSize(imageSrc: string) {
  const image = new Image();
  image.src = imageSrc;

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject();
  });

  return image;
}

async function getCroppedImageByPoints(
  imageSrc: string,
  points: Point[],
  displayWidth: number,
  displayHeight: number
): Promise<Blob> {
  const image = await getImageSize(imageSrc);

  const scaleX = image.naturalWidth / displayWidth;
  const scaleY = image.naturalHeight / displayHeight;

  const minX = Math.min(...points.map((point) => point.x)) * scaleX;
  const minY = Math.min(...points.map((point) => point.y)) * scaleY;
  const maxX = Math.max(...points.map((point) => point.x)) * scaleX;
  const maxY = Math.max(...points.map((point) => point.y)) * scaleY;

  const cropWidth = maxX - minX;
  const cropHeight = maxY - minY;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return new Blob();
  }

  const scale = 3;

canvas.width = cropWidth * scale;
canvas.height = cropHeight * scale;

context.drawImage(
  image,
  minX,
  minY,
  cropWidth,
  cropHeight,
  0,
  0,
  canvas.width,
  canvas.height
);

const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
const data = imageData.data;

for (let i = 0; i < data.length; i += 4) {
  const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  const contrast = gray > 120 ? 255 : 0;

  data[i] = contrast;
  data[i + 1] = contrast;
  data[i + 2] = contrast;
}

const width = canvas.width;
const height = canvas.height;

for (let y = 0; y < height; y++) {
  let blackPixels = 0;

  for (let x = 0; x < width; x++) {
    const index = (y * width + x) * 4;

    if (data[index] === 0) {
      blackPixels++;
    }
  }

  if (blackPixels > width * 0.45) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;

      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
    }
  }
}

for (let x = 0; x < width; x++) {
  let blackPixels = 0;

  for (let y = 0; y < height; y++) {
    const index = (y * width + x) * 4;

    if (data[index] === 0) {
      blackPixels++;
    }
  }

  if (blackPixels > height * 0.45) {
    for (let y = 0; y < height; y++) {
      const index = (y * width + x) * 4;

      data[index] = 255;
      data[index + 1] = 255;
      data[index + 2] = 255;
    }
  }
}

context.putImageData(imageData, 0, 0);

context.putImageData(imageData, 0, 0);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      }
    }, "image/jpeg");
  });
}

export default function Home() {
  const imageWrapperRef = useRef<HTMLDivElement | null>(null);

  const [imagePreview, setImagePreview] = useState<string>("");
  const [croppedImagePreview, setCroppedImagePreview] = useState<string>("");
  const [points, setPoints] = useState<Point[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [amounts, setAmounts] = useState<AmountRow[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [customPercent, setCustomPercent] = useState("23");
  const [weight, setWeight] = useState("");
  const [weightPercent, setWeightPercent] = useState("23");

  function initializePoints(width: number, height: number) {
    setPoints([
      { x: width * 0.15, y: height * 0.15 },
      { x: width * 0.85, y: height * 0.15 },
      { x: width * 0.85, y: height * 0.85 },
      { x: width * 0.15, y: height * 0.85 },
    ]);
  }

  function handleImageChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    const previewUrl = URL.createObjectURL(file);

    setImagePreview(previewUrl);
    setCroppedImagePreview("");
    setPoints([]);
    setAmounts([]);
    setResults([]);
    setIsConfirmed(false);
    setProgress(0);
  }

  function handleImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const width = event.currentTarget.clientWidth;
    const height = event.currentTarget.clientHeight;

    initializePoints(width, height);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (dragIndex === null || !imageWrapperRef.current) return;

    const rect = imageWrapperRef.current.getBoundingClientRect();

    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(event.clientY - rect.top, 0), rect.height);

    setPoints((currentPoints) =>
      currentPoints.map((point, index) =>
        index === dragIndex ? { x, y } : point
      )
    );
  }

  async function recognizeImage(image: Blob) {
    setIsRecognizing(true);
    setProgress(0);
    setAmounts([]);
    setResults([]);
    setIsConfirmed(false);

    try {
      const response = await Tesseract.recognize(image, "eng", {
  logger: (message: any) => {
    if (message.status === "recognizing text") {
      setProgress(Math.round(message.progress * 100));
    }
  },
  config: {
    tessedit_char_whitelist: "0123456789.,",
    tessedit_pageseg_mode: "6",
  },
} as any);

      const foundAmounts = extractAmounts(response.data.text);
      setAmounts(foundAmounts);
    } catch {
      alert("Не вдалося розпізнати фото. Спробуйте зробити чіткіше фото.");
    } finally {
      setIsRecognizing(false);
    }
  }

  async function handleCropAndRecognize() {
    if (!imagePreview || points.length !== 4 || !imageWrapperRef.current) {
      alert("Спочатку виставте 4 кути навколо стовпчика.");
      return;
    }

    const rect = imageWrapperRef.current.getBoundingClientRect();

    const croppedBlob = await getCroppedImageByPoints(
      imagePreview,
      points,
      rect.width,
      rect.height
    );

    const croppedUrl = URL.createObjectURL(croppedBlob);
    setCroppedImagePreview(croppedUrl);

    await recognizeImage(croppedBlob);
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
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Розрахунок накладної
            </h1>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              Завантажте фото, виставте 4 кути навколо стовпчика із сумами,
              перевірте значення і додайте потрібний відсоток.
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

          {imagePreview && !amounts.length && !isRecognizing && (
            <section className="mt-5">
              <h2 className="mb-3 text-xl font-bold text-slate-950">
                Виділіть стовпчик із сумами
              </h2>

              <p className="mb-3 text-sm text-slate-600">
                Потягніть сині точки за кути потрібної області.
              </p>

              <div
                ref={imageWrapperRef}
                onPointerMove={handlePointerMove}
                onPointerUp={() => setDragIndex(null)}
                onPointerLeave={() => setDragIndex(null)}
                className="relative overflow-hidden rounded-[1.5rem] border border-white/60 bg-black shadow-inner touch-none"
              >
                <img
                  src={imagePreview}
                  alt="Фото накладної"
                  onLoad={handleImageLoad}
                  className="block w-full select-none"
                  draggable={false}
                />

                {points.length === 4 && (
                  <>
                    <svg className="pointer-events-none absolute inset-0 h-full w-full">
                      <polygon
                        points={points
                          .map((point) => `${point.x},${point.y}`)
                          .join(" ")}
                        fill="rgba(59, 130, 246, 0.18)"
                        stroke="rgba(59, 130, 246, 0.95)"
                        strokeWidth="3"
                      />
                    </svg>

                    {points.map((point, index) => (
                      <button
                        key={index}
                        type="button"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          setDragIndex(index);
                        }}
                        className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-white bg-blue-500 shadow-lg active:scale-90"
                        style={{
                          left: point.x,
                          top: point.y,
                        }}
                        aria-label={`Кут ${index + 1}`}
                      />
                    ))}
                  </>
                )}
              </div>

              <button
                onClick={handleCropAndRecognize}
                className="mt-4 w-full rounded-2xl bg-blue-500 px-5 py-3 font-bold text-white shadow-lg shadow-blue-500/25 transition active:scale-95"
              >
                Розпізнати виділений стовпчик
              </button>
            </section>
          )}

          {croppedImagePreview && (
            <div className="mt-5 overflow-hidden rounded-[1.5rem] border border-white/60 bg-white/40 p-2 shadow-inner backdrop-blur-xl">
              <p className="mb-2 text-sm font-semibold text-slate-700">
                Обрізана область
              </p>

              <img
                src={croppedImagePreview}
                alt="Обрізана область"
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
                        onChange={(event) =>
                          setWeightPercent(event.target.value)
                        }
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
                      Додати%
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
                              {item.original.toFixed(2)} /{" "}
                              {item.weight.toFixed(3)} кг
                            </span>{" "}

                            <span className="font-semibold text-blue-500">
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

                            <span className="font-semibold text-blue-500">
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