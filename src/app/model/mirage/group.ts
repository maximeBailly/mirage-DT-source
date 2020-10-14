import { Subject, timer } from 'rxjs';
import { filter, first, map } from 'rxjs/operators';
import { Utils } from 'src/app/utils/utils';
import { GameInstance } from '../classes/game-instance';

const updateSource$ = timer(0, 5000);

export class MgGroupHandler {
  /** Total level and drop chance of the party */
  partyInfo$ = updateSource$.pipe(
    map(() =>
      this.membersData.reduce(
        (acc, curr) => ({
          level: acc.level + (curr?.level ?? 0),
          dropChance: acc.dropChance + (curr?.prospecting ?? 0),
        }),
        { level: 0, dropChance: 0 },
      ),
    ),
    filter((info) => !!info.level && !!info.dropChance),
  );

  private get membersData() {
    return (
      this.instance.window?.gui?.party?.currentParty?._childrenList.map(
        (el) => el.memberData,
      ) ?? []
    );
  }

  constructor(private instance: GameInstance) {}

  sendPartyInviteTo(name: string) {
    this.instance.window?.dofus?.connectionManager?.sendMessage?.(
      'PartyInvitationRequestMessage',
      { name },
    );
  }

  acceptNextPartyInvite() {
    const sub = new Subject<any>();

    sub.pipe(first()).subscribe(({ partyId }) => {
      this.instance.window?.dofus?.connectionManager?.sendMessage?.(
        'PartyAcceptInvitationMessage',
        {
          partyId,
        },
      );
      this.instance.actions.removeNotification('party' + partyId);
      this.instance.actions.hidePartyDetails();
    });

    this.instance.window?.dofus?.connectionManager?.on?.(
      'PartyInvitationMessage',
      (response) => sub.next(response),
    );
  }

  autoEnterFight() {
    const test = this.instance.window?.dofus?.connectionManager?.on?.(
      'PartyMemberInFightMessage',
      (response) => {
        if (this.instance.window.isoEngine.mapRenderer.mapId === response.fightMap.mapId) {
          this.joinFight(response.fightId, response.memberId);
        }
      },
    );
    

    this.instance.window?.dofus?.connectionManager?.on?.(
      'MapComplementaryInformationsDataMessage',
      (response) => {
        this.onMapComplementaryInformations(response);
      }
    );

    this.instance.window?.dofus?.connectionManager?.on?.(
      'MapComplementaryInformationsWithCoordsMessage',
      (response) => {
        this.onMapComplementaryInformations(response);
      }
    );
  }

  /**
   * Send a packet for join a fight
   * @param fightId The id of fight we want to join
   * @param fighterId The id of player want join fight
   */
  private joinFight(fightId: number, fighterId: number) {
    if (this.isPvMFight(fightId)) {
      const request = new Promise((resolve, reject) => {
        setTimeout(() => {
          this.instance.window.dofus.connectionManager.sendMessage('GameFightJoinRequestMessage', { fightId, fighterId });
          setTimeout(() => resolve(), 1500);
        }, Utils.getRandomTime(1, 3));
      });

      let paramsAutoReady: boolean = true; // Don't forget to replace by a param option !
      request.then(() => {paramsAutoReady ? this.ready() : '';})
    }
  }

  /** Send a packet to say player is ready */
  private ready() {
    return new Promise((resolve, reject) => {
      if (this.instance.window.gui.fightManager.fightState == 0) {
          setTimeout(() => {
              this.instance.window.dofus.sendMessage("GameFightReadyMessage", { isReady: true });
              setTimeout(() => resolve(), 200);
          }, Utils.getRandomTime(1, 4));
      }
  });
  }

  /**
   * Check if party member is in fight
   * @param response The response received in packet
   */
  private onMapComplementaryInformations(response: any) {
    let partyMemberInFight: boolean = false;

    for (let idFight in response.fights) {
      for (let idTeam in response.fights[idFight].fightTeams) {
        this.membersData.forEach((member) => {

          if (!partyMemberInFight) {
            partyMemberInFight = member.id === response.fights[idFight].fightTeams[idTeam].leaderId;
            if (partyMemberInFight) {
              this.joinFight(response.fights[idFight].fightId, response.fights[idFight].fightTeams[idTeam].leaderId);
            }
          }
        });
      }
    }
  }

  /**
   * Check if the fight is pvm or pvp
   * @param fightId The id of the fight to check
   */
  private async isPvMFight(fightId: number): Promise<boolean> {
    let result: boolean = false;
    await setTimeout(() => {
      const fight0 = this.instance.window.isoEngine.actorManager.actors['fight:' + fightId + ':0'];
      const fight1 = this.instance.window.isoEngine.actorManager.actors['fight:' + fightId + ':1'];
      if (fight0 && fight1) {
          result = fight0.data.teamTypeId == 1 || fight1.data.teamTypeId == 1;
      }
    }, 200);
    
    return result;
  }
}
