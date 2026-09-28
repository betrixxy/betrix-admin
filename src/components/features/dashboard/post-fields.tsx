import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { PLATFORM_LABELS, STATUS_LABELS } from "@/lib/dashboard/social-meta";
import {
  SOCIAL_PLATFORM_TYPES,
  SOCIAL_POST_STATUSES,
  type FixtureOption,
  type SocialPlatformType,
  type SocialPostStatus,
} from "@/types/social";

export interface PostFieldDefaults {
  fixtureId: string;
  platformType: SocialPlatformType | "";
  /** `datetime-local` biçimi: yyyy-MM-ddTHH:mm */
  scheduledFor: string;
  caption: string;
  status: SocialPostStatus;
}

interface PostFieldsProps {
  fixtures: FixtureOption[];
  defaults?: PostFieldDefaults;
  /** Yalnızca düzenlemede: Hazırlanıyor / Paylaşıldı seçimi. */
  showStatus?: boolean;
}

/** Gönderi oluşturma ve düzenleme formlarının ortak alanları. */
export function PostFields({ fixtures, defaults, showStatus = false }: PostFieldsProps) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="fixtureId">Maç</Label>
        <NativeSelect id="fixtureId" name="fixtureId" required defaultValue={defaults?.fixtureId ?? ""}>
          <option value="" disabled>
            Maç seçin…
          </option>
          {fixtures.map((fixture) => (
            <option key={fixture.id} value={fixture.id}>
              {fixture.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="platformType">Platform</Label>
        <NativeSelect id="platformType" name="platformType" required defaultValue={defaults?.platformType ?? ""}>
          <option value="" disabled>
            Platform seçin…
          </option>
          {SOCIAL_PLATFORM_TYPES.map((type) => (
            <option key={type} value={type}>
              {PLATFORM_LABELS[type]}
            </option>
          ))}
        </NativeSelect>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="scheduledFor">Yayın tarihi</Label>
        <Input id="scheduledFor" name="scheduledFor" type="datetime-local" required defaultValue={defaults?.scheduledFor} />
      </div>

      {showStatus ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="status">Durum</Label>
          <NativeSelect id="status" name="status" defaultValue={defaults?.status ?? "PREPARING"}>
            {SOCIAL_POST_STATUSES.map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </NativeSelect>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="caption">Gönderi metni</Label>
        <Textarea id="caption" name="caption" rows={4} maxLength={2200} required defaultValue={defaults?.caption} />
      </div>
    </>
  );
}
