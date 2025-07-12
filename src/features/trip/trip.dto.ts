import { Trip, TripStatus, Location, TripCollaborator, User } from "@prisma/client";

// The user object as returned for a collaborator
type CollaboratorUser = Pick<User, 'id' | 'fullName'>;

// A collaborator with the nested user object
type tripCollaborator = TripCollaborator & {
    user: CollaboratorUser;
};

// The full trip response DTO
export type TripResponseDto = Trip & {
    location: Location;
    collaborators: tripCollaborator[];
};
