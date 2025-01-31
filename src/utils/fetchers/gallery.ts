import type { GalleryResponse } from "../../types/internal.raw.d.ts";
import type { Gallery, Resource } from "../../types/main.js";
import { z } from "zod";
import {
  parseIdentification,
  parseResource,
  parseResources,
} from "../parse.js";

const gallerySchema = z
  .object({
    uuid: z.string().uuid({ message: "Invalid UUID" }),
    filter: z.string().optional(),
    page: z.number().positive({ message: "Page must be positive" }),
    perPage: z.number().positive({ message: "Per page must be positive" }),
  })
  .strict();

/**
 * Fetches and parses a gallery from the OCHRE API
 *
 * @param uuid - The UUID of the gallery
 * @param filter - The filter to apply to the gallery
 * @param page - The page number to fetch
 * @param perPage - The number of items per page
 * @returns The parsed gallery or null if the fetch/parse fails
 *
 * @example
 * ```ts
 * const gallery = await fetchGallery("9c4da06b-f15e-40af-a747-0933eaf3587e", "1978", 1, 12);
 * if (gallery === null) {
 *   console.error("Failed to fetch gallery");
 *   return;
 * }
 * console.log(`Fetched gallery: ${gallery.identification.label}`);
 * console.log(`Contains ${gallery.resources.length.toLocaleString()} resources`);
 * ```
 *
 * @remarks
 * The returned gallery includes:
 * - Gallery metadata and identification
 * - Project identification
 * - Resources (gallery items)
 */
export async function fetchGallery(
  uuid: string,
  filter: string,
  page: number,
  perPage: number,
): Promise<Gallery | null> {
  try {
    const parsed = gallerySchema.safeParse({ uuid, filter, page, perPage });
    if (!parsed.success) {
      throw new Error(parsed.error.message);
    }

    const response = await fetch(
      `https://ochre.lib.uchicago.edu/ochre?xquery=${encodeURIComponent(`
        for $q in input()/ochre[@uuid='${uuid}']
        let $filtered := $q/tree/items/resource[contains(lower-case(identification/label), lower-case('${filter}'))]
        let $maxLength := count($filtered)
        return <gallery maxLength='{$maxLength}'>
          {$q/metadata/project}
          {$q/metadata/item}
          {$filtered[position() >= ${((page - 1) * perPage + 1).toString()} and position() < ${(page * perPage + 1).toString()}]}
        </gallery>
      `)}&format=json`,
    );
    if (!response.ok) {
      throw new Error("Error fetching gallery items, please try again later.");
    }

    const data = (await response.json()) as GalleryResponse;

    if (!("gallery" in data.result)) {
      throw new Error("Failed to fetch gallery");
    }

    const galleryIdentification = parseIdentification(
      data.result.gallery.item.identification,
    );
    const galleryProjectIdentification = parseIdentification(
      data.result.gallery.project.identification,
    );

    const gallery = {
      identification: galleryIdentification,
      projectIdentification: galleryProjectIdentification,
      resources:
        data.result.gallery.resource ?
          Array.isArray(data.result.gallery.resource) ?
            (parseResources(data.result.gallery.resource) as Array<Resource>)
          : [parseResource(data.result.gallery.resource) as Resource]
        : [],
      maxLength: data.result.gallery.maxLength,
    };

    return gallery;
  } catch (error) {
    console.error(error);
    return null;
  }
}
