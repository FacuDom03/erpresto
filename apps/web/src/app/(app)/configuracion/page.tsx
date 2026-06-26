"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  RefreshCw,
  ServerOff,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { getErrorMessage } from "@/lib/api";
import {
  STATIONS_QUERY_KEY,
  getStations,
  updateStations,
} from "@/lib/stations";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function ConfiguracionPage() {
  const queryClient = useQueryClient();

  const stationsQuery = useQuery({
    queryKey: STATIONS_QUERY_KEY,
    queryFn: getStations,
  });

  // Borrador editable local; se sincroniza cada vez que llega data del server.
  const [draft, setDraft] = useState<string[]>([]);
  const [newStation, setNewStation] = useState("");

  useEffect(() => {
    if (stationsQuery.data) {
      setDraft(stationsQuery.data);
    }
  }, [stationsQuery.data]);

  const mutation = useMutation({
    mutationFn: (stations: string[]) => updateStations(stations),
    onSuccess: (stations) => {
      queryClient.setQueryData(STATIONS_QUERY_KEY, stations);
      void queryClient.invalidateQueries({ queryKey: STATIONS_QUERY_KEY });
      setDraft(stations);
      toast.success("Estaciones guardadas");
    },
    onError: (err: unknown) => {
      toast.error(getErrorMessage(err, "No se pudieron guardar las estaciones"));
    },
  });

  const addStation = () => {
    const value = newStation.trim();
    if (!value) return;
    const exists = draft.some(
      (s) => s.toLowerCase() === value.toLowerCase(),
    );
    if (exists) {
      toast.error("Esa estación ya existe");
      return;
    }
    setDraft((prev) => [...prev, value]);
    setNewStation("");
  };

  const renameStation = (index: number, value: string) => {
    setDraft((prev) => prev.map((s, i) => (i === index ? value : s)));
  };

  const removeStation = (index: number) => {
    setDraft((prev) => prev.filter((_, i) => i !== index));
  };

  const isDirty =
    stationsQuery.data != null &&
    (draft.length !== stationsQuery.data.length ||
      draft.some((s, i) => s !== stationsQuery.data![i]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Configuración</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Datos del local, estaciones de preparación e integraciones.
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 md:p-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Estaciones de preparación
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Las estaciones definen a qué pantalla/puesto se rutea cada
              comanda. Asigná la estación de cada producto desde su ficha.
            </p>
          </div>

          {stationsQuery.isPending ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : stationsQuery.isError ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
                <ServerOff className="size-6 text-destructive" />
              </div>
              <p className="font-medium">
                {getErrorMessage(
                  stationsQuery.error,
                  "No se pudieron cargar las estaciones",
                )}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void stationsQuery.refetch()}
              >
                <RefreshCw />
                Reintentar
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                {draft.length === 0 ? (
                  <p className="rounded-lg border border-dashed py-6 text-center text-sm text-muted-foreground">
                    Todavía no hay estaciones. Agregá la primera abajo.
                  </p>
                ) : (
                  draft.map((station, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={station}
                        onChange={(event) =>
                          renameStation(index, event.target.value)
                        }
                        aria-label={`Estación ${index + 1}`}
                        placeholder="Nombre de la estación"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 text-destructive hover:text-destructive [&_svg]:text-destructive"
                        onClick={() => removeStation(index)}
                      >
                        <Trash2 />
                        <span className="sr-only">Eliminar {station}</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="new-station">Agregar estación</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="new-station"
                    value={newStation}
                    onChange={(event) => setNewStation(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addStation();
                      }
                    }}
                    placeholder="Cocina, Barra, Parrilla…"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0"
                    onClick={addStation}
                  >
                    <Plus />
                    Agregar
                  </Button>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  disabled={!isDirty || mutation.isPending}
                  onClick={() => mutation.mutate(draft)}
                >
                  {mutation.isPending && <Loader2 className="animate-spin" />}
                  Guardar cambios
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
