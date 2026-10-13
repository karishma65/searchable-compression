import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StateService } from './services/state.service';
import { NavbarComponent } from './components/navbar/navbar.component';
import { OverviewComponent } from './components/overview/overview.component';
import { DatasetsComponent } from './components/datasets/datasets.component';
import { SearchComponent } from './components/search/search.component';
import { ComparisonComponent } from './components/comparison/comparison.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    OverviewComponent,
    DatasetsComponent,
    SearchComponent,
    ComparisonComponent
  ],
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class App {
  state = inject(StateService);
}

export { App as AppComponent };
