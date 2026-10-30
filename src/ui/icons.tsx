/**
 * The one place icons come from: Solar Icons by 480 Design (CC BY 4.0), React package @solar-icons/react (MIT).
 * Linear style by default; `weight="fill"` swaps to the Bold style (active star/heart), `weight="bold"`/`"light"` change the stroke.
 * Transport controls and the "…" dots are always Bold.
 */
import type { ComponentType } from "react";
import type { IconProps } from "@solar-icons/react";
import { AddIcon } from "@solar-icons/react/linear/add";
import { AltArrowDownIcon } from "@solar-icons/react/linear/alt-arrow-down";
import { AltArrowRightIcon } from "@solar-icons/react/linear/alt-arrow-right";
import { BoxIcon as Box } from "@solar-icons/react/linear/box";
import { CalendarIcon as Calendar } from "@solar-icons/react/linear/calendar";
import { CheckIcon as Check } from "@solar-icons/react/linear/check";
import { CloseIcon as Close } from "@solar-icons/react/linear/close";
import { CloudStorageIcon } from "@solar-icons/react/linear/cloud-storage";
import { CompassIcon as Compass } from "@solar-icons/react/linear/compass";
import { CupHotIcon } from "@solar-icons/react/linear/cup-hot";
import { DownloadMinimalisticIcon } from "@solar-icons/react/linear/download-minimalistic";
import { FileIcon as File } from "@solar-icons/react/linear/file";
import { MusicNoteIcon } from "@solar-icons/react/linear/music-note";
import { FolderIcon as Folder } from "@solar-icons/react/linear/folder";
import { GalleryEditIcon } from "@solar-icons/react/linear/gallery-edit";
import { GalleryRemoveIcon } from "@solar-icons/react/linear/gallery-remove";
import { FolderOpenIcon as FolderOpen } from "@solar-icons/react/linear/folder-open";
import { HamburgerMenuIcon } from "@solar-icons/react/linear/hamburger-menu";
import { HeartIcon as HeartLinear } from "@solar-icons/react/linear/heart";
import { HeartIcon as HeartBold } from "@solar-icons/react/bold/heart";
import { KeyboardIcon as Keyboard } from "@solar-icons/react/linear/keyboard";
import { ListIcon as List } from "@solar-icons/react/linear/list";
import { MagnifierIcon } from "@solar-icons/react/linear/magnifier";
import { MenuDotsIcon } from "@solar-icons/react/bold/menu-dots";
import { MinusCircleIcon as MinusCircle } from "@solar-icons/react/linear/minus-circle";
import { MusicLibrary2Icon } from "@solar-icons/react/linear/music-library-2";
import { PauseIcon as Pause } from "@solar-icons/react/bold/pause";
import { PenIcon as Pen } from "@solar-icons/react/linear/pen";
import { PlayIcon as Play } from "@solar-icons/react/bold/play";
import { RepeatIcon as Repeat } from "@solar-icons/react/linear/repeat";
import { RepeatOneIcon } from "@solar-icons/react/linear/repeat-one";
import { ShuffleIcon as Shuffle } from "@solar-icons/react/linear/shuffle";
import { SkipNextIcon } from "@solar-icons/react/bold/skip-next";
import { SkipPreviousIcon } from "@solar-icons/react/bold/skip-previous";
import { SoundwaveIcon } from "@solar-icons/react/linear/soundwave";
import { StarIcon as StarLinear } from "@solar-icons/react/linear/star";
import { StarIcon as StarBold } from "@solar-icons/react/bold/star";
import { TrashBinTrashIcon } from "@solar-icons/react/linear/trash-bin-trash";
import { UndoLeftRoundIcon } from "@solar-icons/react/linear/undo-left-round";
import { UploadMinimalisticIcon } from "@solar-icons/react/linear/upload-minimalistic";
import { UserRoundedIcon } from "@solar-icons/react/linear/user-rounded";
import { VolumeCrossIcon } from "@solar-icons/react/linear/volume-cross";
import { VolumeLoudIcon } from "@solar-icons/react/linear/volume-loud";
import { VolumeSmallIcon } from "@solar-icons/react/linear/volume-small";
import { WidgetIcon } from "@solar-icons/react/linear/widget";

export { SolarProvider as IconProvider } from "@solar-icons/react";

type Props = Omit<IconProps, "ref"> & { weight?: "regular" | "fill" | "bold" | "light" };
const STROKE = { bold: 2, light: 1.2, regular: undefined, fill: undefined };

function icon(Linear: ComponentType<IconProps>, Bold?: ComponentType<IconProps>) {
  return function Icon({ weight = "regular", ...props }: Props) {
    if (weight === "fill" && Bold) return <Bold {...props} />;
    return <Linear strokeWidth={STROKE[weight]} {...props} />;
  };
}
const solid = (Bold: ComponentType<IconProps>) => ({ weight: _w, ...props }: Props) => <Bold {...props} />;

export const BoxIcon = icon(Box);
export const CalendarIcon = icon(Calendar);
export const CheckIcon = icon(Check);
export const ChevronDownIcon = icon(AltArrowDownIcon);
export const ChevronRightIcon = icon(AltArrowRightIcon);
export const CloseIcon = icon(Close);
export const CloudIcon = icon(CloudStorageIcon);
export const CompassIcon = icon(Compass);
export const CoffeeIcon = icon(CupHotIcon);
export const DotsIcon = solid(MenuDotsIcon);
export const DownloadIcon = icon(DownloadMinimalisticIcon);
export const FileIcon = icon(File);
export const MusicIcon = icon(MusicNoteIcon);
export const FolderIcon = icon(Folder);
export const FolderOpenIcon = icon(FolderOpen);
export const GridIcon = icon(WidgetIcon);
export const ImageIcon = icon(GalleryEditIcon);
export const ImageRemoveIcon = icon(GalleryRemoveIcon);
export const HeartIcon = icon(HeartLinear, HeartBold);
export const KeyboardIcon = icon(Keyboard);
export const LibraryIcon = icon(MusicLibrary2Icon);
export const ListIcon = icon(List);
export const MenuIcon = icon(HamburgerMenuIcon);
export const MinusCircleIcon = icon(MinusCircle);
export const PauseIcon = solid(Pause);
export const PenIcon = icon(Pen);
export const PlayIcon = solid(Play);
export const PlusIcon = icon(AddIcon);
export const RepeatIcon = icon(Repeat);
export const RepeatOnceIcon = icon(RepeatOneIcon);
export const SearchIcon = icon(MagnifierIcon);
export const ShuffleIcon = icon(Shuffle);
export const SkipBackIcon = solid(SkipPreviousIcon);
export const SkipForwardIcon = solid(SkipNextIcon);
export const StarIcon = icon(StarLinear, StarBold);
export const TrashIcon = icon(TrashBinTrashIcon);
export const UndoIcon = icon(UndoLeftRoundIcon);
export const UploadIcon = icon(UploadMinimalisticIcon);
export const UserIcon = icon(UserRoundedIcon);
export const VolumeIcon = icon(VolumeLoudIcon);
export const VolumeLowIcon = icon(VolumeSmallIcon);
export const VolumeMuteIcon = icon(VolumeCrossIcon);
export const WaveformIcon = icon(SoundwaveIcon);
