import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  Input,
  NgZone,
  OnDestroy,
  OnInit,
} from '@angular/core';
import { GameInstance } from '@model';
import {
  InstancesService,
  KeyboardShortcutsService,
  MgKeyboardShortcut,
  SystemService,
} from '@providers';
import { BehaviorSubject, Subscription, timer } from 'rxjs';
import { filter, first, map, switchMap, tap } from 'rxjs/operators';
import { InstallationService } from 'src/app/core/installation/installation.service';
import { SpellPreview } from 'src/app/model/mirage/spells';

@Component({
  selector: 'mg-game-instance',
  templateUrl: './game-instance.component.html',
  styleUrls: ['./game-instance.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [],
})
export class GameInstanceComponent implements OnInit, OnDestroy {
  @Input() instance: GameInstance;

  src$ = this.installation.gamePath$;

  previews$ = new BehaviorSubject<SpellPreview[]>([]);

  private susbscriptions = new Subscription();

  constructor(
    private cdRef: ChangeDetectorRef,
    private installation: InstallationService,
    private instancesService: InstancesService,
    private zone: NgZone,
    private shortcuts: KeyboardShortcutsService,
    private system: SystemService,
  ) {}

  ngOnDestroy() {
    this.instance.events.subscriptions.unsubscribe();
    this.susbscriptions.unsubscribe();
  }

  clearPreviews() {
    this.previews$.next([]);
    this.cdRef.detectChanges();
  }

  ngOnInit(): void {
    this.zone.run(() => {
      this.instance.actions.connectAccount();

      this._setActiveOnTurnStart();

      this.instance.events.subscriptions.add(
        this.instance.events.characterSpellCast$
          .pipe(
            map((spellId) => this.instance.spells.previewDamages(spellId)),
            tap((previews) => this.previews$.next(previews)),
          )
          .subscribe(() => this.cdRef.detectChanges()),
      );

      this.instance.events.subscriptions.add(
        this.instance.events.characterSpellUncast$.subscribe(() =>
          this.clearPreviews(),
        ),
      );

      this.susbscriptions.add(
        this.instance.events.characterLogin$.subscribe(() => {
          this.instance.actions.removeShopButton();
          this.instance.injecter.addSpellsDoubleTapListener();
          this.instance.groupManager.autoEnterFight();
        }),
      );

      this.susbscriptions.add(
        this.instance.events.characterLogin$.pipe(first()).subscribe(() => {
          this.instance.injecter.addMinusOneKamaSellingButton();
          this.instance.injecter.addRemoveAllCurrentlySellingItemsButton();
          this.instance.injecter.addLongTapEventOnBuyButton();
        }),
      );

      this.susbscriptions.add(
        this.instance.events.characterLogin$
          .pipe(switchMap(() => timer(60000, 60000)))
          .subscribe(() => this.instance.actions.preventInactivity()),
      );

      this.susbscriptions.add(
        this.instance.groupManager.partyInfo$.subscribe((infos) => {
          const placeholder = this.instance.injecter.placeholderPartyInfo;
          if (!placeholder) return;
          placeholder.innerHTML = `🌟 ${infos.level} <br /> 🔎 ${infos.dropChance}`;
        }),
      );

      this.susbscriptions.add(
        this.instance.events.characterLogin$
          .pipe(
            filter(() => !this.system.isCordova),
            tap(() => this.instance.injecter.addBindingsToShortcutSlots()),
            switchMap(() => this.shortcuts.slotShortcuts$),
          )
          .subscribe((shortcuts) => this._addShortcutsKeysToSlots(shortcuts)),
      );

      this.susbscriptions.add(
        this.instance.events.keyDown$
          .pipe(filter(() => !this.system.isCordova))
          .subscribe((event) =>
            this.shortcuts.runShortcut(this.instance, event),
          ),
      );
    });
  }

  /**
   * On fight turn start, sets the instance as active
   */
  private _setActiveOnTurnStart() {
    this.susbscriptions.add(
      this.instance.events.characterFightTurnStart$.subscribe(() => {
        this.instancesService.setActiveInstance(this.instance);
      }),
    );
  }

  /**
   * Adds the shortcuts bindings on the slots
   * @param shortcuts Shortcuts to bind to the slots
   */
  private _addShortcutsKeysToSlots(shortcuts: MgKeyboardShortcut[]) {
    const [spellsSlotsEls, itemsSlotsEls] = [
      this.instance.gui.spellsSlots.map((v) => v.rootElement),
      this.instance.gui.itemsSlots.map((v) => v.rootElement),
    ];

    shortcuts.forEach((shortcut) =>
      this.instance.gui.setShortcutBindingOnSlot(
        shortcut.listIndex,
        shortcut.name,
      ),
    );
  }
}
